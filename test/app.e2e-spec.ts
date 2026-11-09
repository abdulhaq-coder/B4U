import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { MediaPurpose, Role, SalonType, Weekday } from '@prisma/client';
import { createHmac } from 'crypto';

describe('Salon & Parlour API End-to-End Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------- 1. Health & Discovery ----------
  describe('1. Health & Discovery', () => {
    it('GET /api/v1/health should return 200 OK and database connected', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
    });

    it('GET /api/v1/locations/cities should return list of active Pakistani cities', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/locations/cities?countryCode=PK')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(20);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('province');
    });
  });

  // ---------- 2. Customer Lifecycle ----------
  describe('2. Customer Registration, Onboarding & Security', () => {
    const customerEmail = `customer_${Date.now()}@example.com`;
    let customerAccessToken: string;
    let customerRefreshToken: string;
    let cityId: string;

    it('POST /api/v1/auth/register should register a pending customer', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Ayesha Khan',
          email: customerEmail,
          role: 'CUSTOMER',
          password: 'Password123',
          confirmPassword: 'Password123',
          acceptTerms: true,
        })
        .expect(201);

      expect(res.body.email).toBe(customerEmail);
    });

    it('POST /api/v1/auth/otp/verify should verify email and return tokens with COMPLETE_PROFILE', async () => {
      // Direct DB helper to simulate reading code from email
      const otpSecret = process.env.OTP_SECRET || 'salon_super_secure_otp_secret_key_2026_hash_minimum_32';
      
      // Update DB with a deterministic known code for testing
      const knownCode = '654321';
      const codeHash = createHmac('sha256', otpSecret)
        .update(`EMAIL_VERIFICATION:${customerEmail}:${knownCode}`)
        .digest('hex');

      await prisma.otpCode.updateMany({
        where: { email: customerEmail, purpose: 'EMAIL_VERIFICATION', consumedAt: null },
        data: { codeHash },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ email: customerEmail, code: knownCode })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.nextStep).toBe('COMPLETE_PROFILE');
      expect(res.body.user.profileCompleted).toBe(false);

      customerAccessToken = res.body.accessToken;
      customerRefreshToken = res.body.refreshToken;
    });

    it('Guards should block incomplete profile customer from protected operations with ONBOARDING_INCOMPLETE', async () => {
      // Trying to access an endpoint that does NOT have @AllowIncompleteProfile()
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ fullName: 'Ayesha Khan Updated' })
        .expect(403);

      expect(res.body.code).toBe('ONBOARDING_INCOMPLETE');
    });

    it('PATCH /api/v1/auth/profile/complete should complete customer profile and set nextStep HOME', async () => {
      const cities = await prisma.city.findMany({ take: 1 });
      cityId = cities[0].id;

      const res = await request(app.getHttpServer())
        .patch('/api/v1/auth/profile/complete')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          dateOfBirth: '1998-05-20',
          phone: '0300 1234567',
          gender: 'FEMALE',
          countryCode: 'PK',
          cityId,
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.nextStep).toBe('HOME');
      expect(res.body.user.profileCompleted).toBe(true);

      customerAccessToken = res.body.accessToken;
    });

    it('PATCH /api/v1/users/profile should now allow editing profile for fully onboarded customer', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          fullName: 'Ayesha Tariq Khan',
          phone: '0300 7654321',
        })
        .expect(200);

      expect(res.body.user.fullName).toBe('Ayesha Tariq Khan');
      expect(res.body.user.phone).toBe('+923007654321');
    });

    it('POST /api/v1/auth/login should allow password login for customer', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: customerEmail,
          password: 'Password123',
          role: 'CUSTOMER',
        })
        .expect(200);

      expect(res.body.user.email).toBe(customerEmail);
      expect(res.body.nextStep).toBe('HOME');
    });

    it('Login with wrong password should fail with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: customerEmail,
          password: 'WrongPassword!',
          role: 'CUSTOMER',
        })
        .expect(401);

      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('Login with mismatched role should fail with 403 WRONG_APP', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: customerEmail,
          password: 'Password123',
          role: 'OWNER',
        })
        .expect(403);

      expect(res.body.code).toBe('WRONG_APP');
    });
  });

  // ---------- 3. Owner Onboarding & Admin Approvals ----------
  describe('3. Multi-Branch Owner Onboarding & Platform Admin Approvals', () => {
    const ownerEmail = `owner_${Date.now()}@example.com`;
    let ownerAccessToken: string;
    let ownerId: string;
    let branchId: string;
    let mockMediaId: string;
    let adminAccessToken: string;

    it('Register and verify Salon Owner', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Sarah Tariq',
          email: ownerEmail,
          role: 'OWNER',
          password: 'OwnerPass123',
          confirmPassword: 'OwnerPass123',
          acceptTerms: true,
        })
        .expect(201);

      const otpSecret = process.env.OTP_SECRET || 'salon_super_secure_otp_secret_key_2026_hash_minimum_32';
      const knownCode = '112233';
      const codeHash = createHmac('sha256', otpSecret)
        .update(`EMAIL_VERIFICATION:${ownerEmail}:${knownCode}`)
        .digest('hex');

      await prisma.otpCode.updateMany({
        where: { email: ownerEmail, purpose: 'EMAIL_VERIFICATION', consumedAt: null },
        data: { codeHash },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ email: ownerEmail, code: knownCode })
        .expect(200);

      expect(res.body.nextStep).toBe('OWNER_SETUP');
      ownerAccessToken = res.body.accessToken;
      ownerId = res.body.user.id;
    });

    it('Owner can check initial onboarding state', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/owner/onboarding')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(res.body.hasBrand).toBe(false);
      expect(res.body.currentStep).toBe(1);
    });

    it('Step 1: Save Brand details and first Branch location with image', async () => {
      const cities = await prisma.city.findMany({ take: 1 });
      const cityId = cities[0].id;

      // Seed a test media asset for owner
      const media = await prisma.mediaAsset.create({
        data: {
          ownerId,
          purpose: MediaPurpose.BRANCH_IMAGE,
          key: `branch_image/${ownerId}/mock-branch.webp`,
          width: 1600,
          height: 1200,
          sizeBytes: 150000,
        },
      });
      mockMediaId = media.id;

      const res = await request(app.getHttpServer())
        .post('/api/v1/owner/onboarding/step1')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          brandName: 'Glow Studio',
          brandBio: 'High end hair styling and organic skin care',
          branchName: 'Main Branch',
          phone: '0300 4455667',
          addressLine: 'Plot 45, Commercial Avenue, DHA Phase 6',
          cityId,
          type: 'LADIES',
          imageIds: [mockMediaId],
        })
        .expect(201);

      expect(res.body).toHaveProperty('branchId');
      expect(res.body.nextStep).toBe('STEP_3_HOURS');
      branchId = res.body.branchId;
    });

    it('Step 3: Save branch operating hours', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/owner/branches/${branchId}/hours`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          hours: [
            { day: 'MONDAY', opensAtMin: 600, closesAtMin: 1260 },
            { day: 'TUESDAY', opensAtMin: 600, closesAtMin: 1260 },
            { day: 'WEDNESDAY', opensAtMin: 600, closesAtMin: 1260 },
            { day: 'THURSDAY', opensAtMin: 600, closesAtMin: 1260 },
            { day: 'FRIDAY', opensAtMin: 900, closesAtMin: 1320 },
            { day: 'SATURDAY', opensAtMin: 600, closesAtMin: 1320 },
          ],
        })
        .expect(201);

      expect(res.body.canSubmit).toBe(true);
    });

    it('Submit Branch for Admin approval', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/owner/branches/${branchId}/submit`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(201);

      expect(res.body.status).toBe('PENDING_APPROVAL');
    });

    it('Platform Admin can login and list pending branches', async () => {
      const adminLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@salon.local',
          password: process.env.ADMIN_PASSWORD || 'ChangeMe-Strong-Pass-123',
          role: 'ADMIN',
        })
        .expect(200);

      adminAccessToken = adminLogin.body.accessToken;

      const pendingRes = await request(app.getHttpServer())
        .get('/api/v1/admin/branches/pending')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(pendingRes.body.total).toBeGreaterThanOrEqual(1);
      const found = pendingRes.body.data.find((b: any) => b.id === branchId);
      expect(found).toBeDefined();
      expect(found.brandName).toBe('Glow Studio');
    });

    it('Platform Admin approves branch', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/branches/${branchId}/approve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.branchId).toBe(branchId);
    });

    it('Owner gets branch details and verifies status is now APPROVED', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/owner/branches/${branchId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(res.body.status).toBe('APPROVED');
      expect(res.body.displayName).toBe('Glow Studio – Main Branch');
    });
  });

  // ---------- 4. RBAC & Access Control ----------
  describe('4. RBAC & Security Isolation', () => {
    let customerToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: (await prisma.user.findFirst({ where: { role: Role.CUSTOMER } }))?.email,
          password: 'Password123',
          role: 'CUSTOMER',
        });
      customerToken = res.body.accessToken;
    });

    it('Customer cannot access Admin endpoints (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/branches/pending')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('Customer cannot access Owner endpoints (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/owner/onboarding')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });
});

