# 📖 Salon & Parlour Booking Backend — Complete Architecture & Implementation Guide

> **Project:** Enterprise Scalable Salon & Parlour Booking Platform (Pakistan-Wide)  
> **Tech Stack:** Node.js (v22), NestJS (v10), TypeScript (v5), PostgreSQL, Prisma ORM (v6), Redis, MinIO/S3, Docker  
> **Security:** Argon2id Password Hashing, HMAC-SHA256 Email OTP, Dual Token Rotation (Access 15m / Refresh 7d) with Reuse Detection, Global Rate Limiting (Throttler), Helmet, Strict CORS, HttpOnly Cookie delivery for Web, Role-based Access Control (RBAC), Onboarding Guard.

---

## 📑 Table of Contents
1. [Project Structure (Directory Tree)](#1-project-structure-directory-tree)
2. [Database Architecture & Schema (`prisma/schema.prisma`)](#2-database-architecture--schema)
3. [Database Seeder (`prisma/seed.ts`)](#3-database-seeder)
4. [Environment & Configuration](#4-environment--configuration)
5. [Common Core (Guards, Decorators, Utils, Validators)](#5-common-core)
6. [Media Module (S3 / MinIO / Sharp Image Processing)](#6-media-module)
7. [Locations Module (Pakistan Cities & Provinces)](#7-locations-module)
8. [Users Module (User Model & Output Mappers)](#8-users-module)
9. [Authentication Module (Complete Auth, Social & Password Lifecycle)](#9-authentication-module)
10. [Application Entry Points (`main.ts` & `app.module.ts`)](#10-application-entry-points)
11. [Testing & API Verification (cURL Guide)](#11-testing--api-verification-curl-guide)
12. [Upcoming Milestones (Roadmap)](#12-upcoming-milestones-roadmap)

---

## 1. Project Structure (Directory Tree)

```text
parlour_backend/
│
├── docker-compose.yml              # PostgreSQL 16, Redis 7, Mailpit, MinIO S3 & MinIO-init
├── package.json                    # Project metadata, scripts, dependencies
├── tsconfig.json                   # TypeScript compiler options
├── tsconfig.build.json             # Build output exclusion configuration
├── nest-cli.json                   # Nest CLI configuration with Swagger plugin
├── .env                            # Active environment variables (git-ignored)
├── .env.example                    # Sample environment template
├── .gitignore                      # Git ignore rules
├── guide.md                        # Complete project blueprint & documentation
│
├── prisma/
│   ├── schema.prisma               # Enterprise database schema (Users, Brands, Branches, Media, etc.)
│   └── seed.ts                     # Database seeder (29 Pakistan cities + Default Admin)
│
├── test/
│   ├── jest-e2e.json               # E2E test configuration
│   └── app.e2e-spec.ts             # 20-point automated E2E test suite (Health, Cust, Owner, Admin, RBAC)
│
└── src/
    ├── main.ts                     # Application bootstrap (Helmet, Cookies, Versioning, Swagger)
    ├── app.module.ts               # Root module configuring global guards pipeline
    │
    ├── config/
    │   └── env.validation.ts       # Strict Zod validation for runtime environment
    │
    ├── prisma/
    │   ├── prisma.service.ts       # PrismaClient lifecycle hooks (connect/disconnect)
    │   └── prisma.module.ts        # Global Prisma module
    │
    ├── common/
    │   ├── constants/
    │   │   ├── roles.ts            # CLIENT_ROLES & LOGIN_ROLES definitions
    │   │   └── legal.ts            # Terms & Conditions version constant
    │   ├── decorators/
    │   │   ├── public.decorator.ts                  # @Public() bypasses JWT authentication
    │   │   ├── roles.decorator.ts                   # @Roles(...) assigns role requirements
    │   │   ├── current-user.decorator.ts            # @CurrentUser() extracts AuthUser
    │   │   └── allow-incomplete-profile.decorator.ts # @AllowIncompleteProfile() bypasses onboarding guard
    │   ├── filters/
    │   │   └── http-exception.filter.ts             # Unified error envelope { statusCode, code, message, errors }
    │   ├── guards/
    │   │   ├── jwt-auth.guard.ts           # JWT authentication guard (default protected)
    │   │   ├── roles.guard.ts              # RBAC guard matching user role with endpoint
    │   │   └── profile-completed.guard.ts  # Onboarding guard enforcing completed profile
    │   ├── utils/
    │   │   ├── date.util.ts                # ISO Date parsing & age calculation
    │   │   ├── phone.util.ts               # E.164 Pakistan mobile normalization
    │   │   ├── csv.util.ts                 # CSV string parser for CORS & Client IDs
    │   │   └── media-url.util.ts           # S3/MinIO public URL constructor
    │   └── validators/
    │       ├── match.decorator.ts          # @Match('field') cross-field validator
    │       └── password.decorator.ts       # @PasswordField() unified password rules
    │
    └── modules/
        ├── health/
        │   ├── health.controller.ts        # GET /api/v1/health (DB ping)
        │   └── health.module.ts
        │
        ├── mail/
        │   ├── mail.service.ts             # Nodemailer service (HTML OTP templates, offline-safe)
        │   └── mail.module.ts
        │
        ├── locations/
        │   ├── dto/
        │   │   └── list-cities-query.dto.ts # City filtering query (defaults to PK)
        │   ├── locations.service.ts        # Active cities database queries
        │   ├── locations.controller.ts     # GET /api/v1/locations/cities
        │   └── locations.module.ts
        │
        ├── media/
        │   ├── dto/
        │   │   └── upload-image.dto.ts     # Upload purpose validation (AVATAR, BRANCH_IMAGE, etc.)
        │   ├── media.service.ts            # Sharp WebP conversion + S3 upload & atomic claim/release
        │   ├── media.controller.ts         # POST /api/v1/media/images (Multipart file upload)
        │   └── media.module.ts
        │
        ├── users/
        │   ├── dto/
        │   │   └── edit-profile.dto.ts     # Profile update validation
        │   ├── user.mapper.ts              # User response sanitization & nextStep state machine
        │   ├── users.service.ts            # User persistence, failed login counts, profile edit, soft delete
        │   ├── users.controller.ts         # GET /api/v1/users/profile, PATCH profile, DELETE me
        │   └── users.module.ts
        │
        ├── owner/
        │   ├── dto/
        │   │   ├── step1-onboarding.dto.ts # Brand name/bio + first Branch address & image
        │   │   ├── step3-hours.dto.ts      # Weekly opening/closing schedule
        │   │   └── create-branch.dto.ts    # Subsequent branch creation (up to 30)
        │   ├── owner.service.ts            # Multi-branch onboarding & ownership enforcement
        │   ├── owner.controller.ts         # /api/v1/owner/onboarding & /branches endpoints
        │   └── owner.module.ts
        │
        ├── admin/
        │   ├── dto/
        │   │   ├── reject-branch.dto.ts    # Rejection reason validation
        │   │   └── trust-brand.dto.ts      # Trusted status & maxBranches limit
        │   ├── admin.service.ts            # Moderation queue, approve/reject, trust brands
        │   ├── admin.controller.ts         # /api/v1/admin/branches & /brands endpoints
        │   └── admin.module.ts
        │
        └── auth/
            ├── interfaces/
            │   └── jwt-payload.interface.ts # JwtPayload, RefreshPayload, AuthUser, AuthTokens
            ├── strategies/
            │   └── jwt.strategy.ts         # Passport JWT extraction and validation
            ├── dto/
            │   ├── register.dto.ts         # Customer/Owner signup
            │   ├── login.dto.ts            # Multi-role password login
            │   ├── request-otp.dto.ts      # Base email validation
            │   ├── verify-otp.dto.ts       # 6-digit code validation
            │   ├── refresh-token.dto.ts    # Mobile body refresh token
            │   ├── complete-profile.dto.ts # Customer profile (DOB, Phone, Gender, City, Avatar)
            │   ├── reset-password.dto.ts   # Forgot password OTP + new password
            │   ├── change-password.dto.ts  # Authenticated password update
            │   ├── set-password.dto.ts     # Initial password for social accounts
            │   └── social-login.dto.ts     # Google & Apple ID token payload
            ├── social/
            │   ├── social-profile.interface.ts
            │   ├── nonce.util.ts           # Replay attack prevention check
            │   ├── google.verifier.ts      # Google ID Token verification via OAuth2Client
            │   ├── apple.verifier.ts       # Apple ID Token verification via Jose Remote JWKS
            │   └── social-auth.service.ts  # Social login, account linking, auto-verification
            ├── auth-response.util.ts       # Shared token and user payload formatter
            ├── otp.service.ts              # HMAC-SHA256 OTP generation & atomic consumption
            ├── token.service.ts            # Access Token issue, Refresh rotation & session revocation
            ├── password.service.ts         # Argon2id hashing & dummy verification (timing defense)
            ├── password-flow.service.ts    # Forgot, reset, change, and set password workflows
            ├── refresh-cookie.service.ts   # HttpOnly, SameSite=Lax cookie management for Web
            ├── auth.service.ts             # Core auth orchestration
            ├── auth.controller.ts          # Authentication HTTP endpoints
            └── auth.module.ts
```

---

## 2. Database Architecture & Schema

### `prisma/schema.prisma`
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  CUSTOMER
  OWNER
  STAFF
  ADMIN
}

enum UserStatus {
  PENDING_VERIFICATION
  ACTIVE
  SUSPENDED
}

enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}

enum OtpPurpose {
  EMAIL_VERIFICATION
  PASSWORD_RESET
}

enum SocialProvider {
  GOOGLE
  APPLE
}

enum MediaPurpose {
  AVATAR
  BRAND_LOGO
  BRANCH_IMAGE
  SERVICE_IMAGE
}

enum BranchStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  REJECTED
  SUSPENDED
}

enum SalonType {
  LADIES
  GENTS
  UNISEX
}

enum Weekday {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

model User {
  id              String     @id @default(uuid())
  email           String     @unique
  fullName        String
  passwordHash    String?
  role            Role
  status          UserStatus @default(PENDING_VERIFICATION)
  emailVerifiedAt DateTime?
  termsAcceptedAt DateTime
  termsVersion    String

  dateOfBirth        DateTime? @db.Date
  phone              String?
  gender             Gender?
  countryCode        String?   @db.Char(2)
  cityId             String?
  city               City?     @relation(fields: [cityId], references: [id])
  profileCompletedAt DateTime?

  avatarId String?     @unique
  avatar   MediaAsset? @relation("UserAvatar", fields: [avatarId], references: [id], onDelete: SetNull)

  failedLoginCount Int       @default(0)
  lockedUntil      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  sessions         Session[]
  socialAccounts   SocialAccount[]
  mediaAssets      MediaAsset[]          @relation("MediaOwner")
  brand            Brand?
  reviewedBranches Branch[]              @relation("BranchReviewer")
  branchHistory    BranchStatusHistory[] @relation("BranchHistoryActor")

  @@index([cityId])
  @@map("users")
}

model SocialAccount {
  id             String         @id @default(uuid())
  userId         String
  user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider       SocialProvider
  providerUserId String
  email          String?
  createdAt      DateTime       @default(now())

  @@unique([provider, providerUserId])
  @@index([userId])
  @@map("social_accounts")
}

model City {
  id          String   @id @default(uuid())
  name        String
  province    String
  countryCode String   @default("PK") @db.Char(2)
  isActive    Boolean  @default(true)
  users       User[]
  branches    Branch[]

  @@unique([countryCode, name])
  @@map("cities")
}

model OtpCode {
  id         String     @id @default(uuid())
  email      String
  purpose    OtpPurpose
  codeHash   String
  attempts   Int        @default(0)
  expiresAt  DateTime
  consumedAt DateTime?
  createdAt  DateTime   @default(now())

  @@index([email, purpose, createdAt])
  @@map("otp_codes")
}

model Session {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokenHash String
  userAgent        String?
  ip               String?
  expiresAt        DateTime
  revokedAt        DateTime?
  createdAt        DateTime  @default(now())

  @@index([userId])
  @@map("sessions")
}

model MediaAsset {
  id        String       @id @default(uuid())
  ownerId   String
  owner     User         @relation("MediaOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  purpose   MediaPurpose
  key       String       @unique
  width     Int
  height    Int
  sizeBytes Int
  usedBy    String? // "USER:<id>", "BRANCH:<id>" ... null = unused
  createdAt DateTime     @default(now())

  avatarOf    User?        @relation("UserAvatar")
  brandLogoOf Brand?       @relation("BrandLogo")
  branchImage BranchImage? @relation("BranchImageMedia")

  @@index([ownerId, usedBy])
  @@map("media_assets")
}

model Brand {
  id          String      @id @default(uuid())
  ownerId     String      @unique
  owner       User        @relation(fields: [ownerId], references: [id])
  name        String
  bio         String?
  logoId      String?     @unique
  logo        MediaAsset? @relation("BrandLogo", fields: [logoId], references: [id], onDelete: SetNull)
  verifiedAt  DateTime?   // Set upon first branch approval
  isTrusted   Boolean     @default(false) // Auto-approves future branches
  branchLimit Int         @default(5)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  branches    Branch[]

  @@map("brands")
}

model Branch {
  id               String       @id @default(uuid())
  brandId          String
  brand            Brand        @relation(fields: [brandId], references: [id], onDelete: Cascade)
  name             String?      // e.g. "Safoora", null for standalone
  phone            String
  addressLine      String
  cityId           String
  city             City         @relation(fields: [cityId], references: [id])
  latitude         Float?
  longitude        Float?
  type             SalonType
  timezone         String       @default("Asia/Karachi")
  status           BranchStatus @default(DRAFT)
  rejectionReason  String?
  step1CompletedAt DateTime?
  step2CompletedAt DateTime?
  step3CompletedAt DateTime?
  submittedAt      DateTime?
  reviewedAt       DateTime?
  reviewedById     String?
  reviewedBy       User?        @relation("BranchReviewer", fields: [reviewedById], references: [id])
  approvedAt       DateTime?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  images  BranchImage[]
  hours   BranchHours[]
  history BranchStatusHistory[]

  @@index([brandId])
  @@index([cityId, status])
  @@index([status, submittedAt])
  @@map("branches")
}

model BranchImage {
  id        String     @id @default(uuid())
  branchId  String
  branch    Branch     @relation(fields: [branchId], references: [id], onDelete: Cascade)
  mediaId   String     @unique
  media     MediaAsset @relation("BranchImageMedia", fields: [mediaId], references: [id])
  sortOrder Int        // 0 = Cover

  @@unique([branchId, sortOrder])
  @@map("branch_images")
}

model BranchHours {
  id          String  @id @default(uuid())
  branchId    String
  branch      Branch  @relation(fields: [branchId], references: [id], onDelete: Cascade)
  day         Weekday
  opensAtMin  Int     // Minutes from midnight (e.g. 10:00 = 600)
  closesAtMin Int

  @@index([branchId, day])
  @@map("branch_hours")
}

model BranchStatusHistory {
  id         String        @id @default(uuid())
  branchId   String
  branch     Branch        @relation(fields: [branchId], references: [id], onDelete: Cascade)
  fromStatus BranchStatus?
  toStatus   BranchStatus
  byUserId   String?
  byUser     User?         @relation("BranchHistoryActor", fields: [byUserId], references: [id])
  reason     String?
  createdAt  DateTime      @default(now())

  @@index([branchId, createdAt])
  @@map("branch_status_history")
}
```

---

## 3. Database Seeder

### `prisma/seed.ts`
Populates all **29 Pakistani cities** across all provinces and sets up the **Platform Admin**:
- **Admin Email:** Read from `ADMIN_EMAIL` in `.env` (e.g. `admin@salon.local`)
- **Admin Password:** Read from `ADMIN_PASSWORD` in `.env` (Hashed with Argon2id)

To run the seed at any time:
```bash
npx prisma db seed
```

---

## 4. Environment & Configuration

### Environment Configuration Template (`.env.example`)
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://<db_user>:<db_password>@localhost:5432/<db_name>?schema=public
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

JWT_ACCESS_SECRET=<jwt_access_secret_min_32_chars>
JWT_REFRESH_SECRET=<jwt_refresh_secret_min_32_chars>
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_DAYS=7
OTP_SECRET=<otp_secret_min_32_chars>

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Salon App <no-reply@salon.local>"

GOOGLE_CLIENT_IDS=
APPLE_CLIENT_IDS=

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=salon-media
S3_ACCESS_KEY_ID=<minio_or_s3_key>
S3_SECRET_ACCESS_KEY=<minio_or_s3_secret>
S3_FORCE_PATH_STYLE=true
MEDIA_PUBLIC_BASE_URL=http://localhost:9000/salon-media

ADMIN_EMAIL=admin@salon.local
ADMIN_PASSWORD=<admin_password_min_12_chars>
```

### Docker Containers (`docker-compose.yml`)
- **Postgres 16:** Port `5432`
- **Redis 7:** Port `6379`
- **Mailpit:** SMTP on `1025`, Web UI on `http://localhost:8025`
- **MinIO S3:** API on `9000`, Console on `http://localhost:9001`
- **MinIO-Init:** Automates creation of public bucket `salon-media`

---

## 5. Common Core

### `src/common/guards/profile-completed.guard.ts`
Blocks un-onboarded accounts from accessing core platform resources with a `403 Forbidden` response:
```json
{
  "code": "ONBOARDING_INCOMPLETE",
  "message": "Please complete your account setup first"
}
```

Routes decorated with `@AllowIncompleteProfile()` or `@Public()` bypass this guard so users can view their profile, complete their profile, or log out.

### `src/common/utils/phone.util.ts`
Normalizes any Pakistani phone number format into strict E.164:
- `0300 1234567` ➔ `+923001234567`
- `+92 300 1234567` ➔ `+923001234567`
- Rejects non-working / invalid mobile prefixes.

---

## 6. Media Module

Provides image upload, sanitization, and storage using Sharp and S3 / MinIO.

### Supported Profiles:
| Purpose | Max Dimensions | Fit Mode | Quality | Output Format |
| :--- | :--- | :--- | :--- | :--- |
| `AVATAR` | 512x512 | Cover (Square) | 80% | WebP |
| `BRAND_LOGO` | 512x512 | Inside (Aspect Preserved) | 80% | WebP |
| `BRANCH_IMAGE` | 1600x1600 | Inside | 80% | WebP |
| `SERVICE_IMAGE`| 1200x1200 | Inside | 80% | WebP |

### Security Measures:
- Strips EXIF metadata & GPS location tags.
- Converts everything to WebP to eliminate malicious polyglot file uploads.
- Limits input buffer to 40M pixels (protection against decompression bombs).
- Maximum 30 unused images per user to prevent storage abuse.
- Atomic `claim()` and `release()` ensures images are only assigned to their true owner and referenced entity.

---

## 7. Locations Module

- `GET /api/v1/locations/cities?countryCode=PK`: Returns list of all active Pakistani cities sorted alphabetically with province details.

---

## 8. Users Module

### Next Step State Machine (`user.mapper.ts`)
Controls user redirection in the frontend/mobile apps:
1. `SET_PASSWORD`: User signed in via Google/Apple and has not created a local password.
2. `COMPLETE_PROFILE`: Customer has not entered DOB, gender, phone, or city.
3. `OWNER_SETUP`: Owner has not yet registered their brand, branch, or working hours.
4. `HOME`: Fully onboarded user.

---

## 9. Authentication Module

### Core Endpoints (`/api/v1/auth/`)
| Method | Endpoint | Description | Guard / Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Signup with email, password, full name, role | Public |
| `POST` | `/otp/verify` | Verifies registration OTP and returns tokens | Public |
| `POST` | `/otp/resend` | Resends registration OTP | Public |
| `POST` | `/login` | Password login for CUSTOMER, OWNER, ADMIN | Public |
| `POST` | `/social/google`| Google ID Token login | Public |
| `POST` | `/social/apple` | Apple ID Token login | Public |
| `POST` | `/refresh` | Rotates refresh token (Web Cookie or Mobile Body) | Public |
| `PATCH`| `/profile/complete` | Submits DOB, phone, gender, cityId, avatarId | Customer Only |
| `GET`  | `/me` | Fetches current user profile and `nextStep` | Authenticated |
| `POST` | `/logout` | Revokes current session | Authenticated |
| `POST` | `/logout-all` | Revokes all user sessions across devices | Authenticated |
| `POST` | `/password/forgot` | Sends password reset OTP | Public |
| `POST` | `/password/reset` | Resets password with OTP + new password | Public |
| `POST` | `/password/change`| Changes password with old password | Authenticated |
| `POST` | `/password/set` | Sets initial password for social users | Authenticated |

---

## 10. Application Entry Points

### `src/main.ts`
- **Helmet**: Secures HTTP response headers.
- **Cookie Parser**: Parses incoming `salon_rt` refresh token cookies.
- **CORS**: Reads allowed origins from `CORS_ORIGINS`.
- **ValidationPipe**: Rejects non-whitelisted fields (`forbidNonWhitelisted: true`).
- **Swagger Documentation**: Available at `http://localhost:3000/docs`.

### Global Guard Order in `src/app.module.ts`:
1. `ThrottlerGuard` (100 requests / minute)
2. `JwtAuthGuard` (JWT Bearer Token validation)
3. `ProfileCompletedGuard` (Account onboarding verification)
4. `RolesGuard` (Role-based access verification)

---

## 11. Testing & API Verification (cURL Guide)

### 1. Register a Customer
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Ayesha Khan",
    "email": "ayesha@example.com",
    "role": "CUSTOMER",
    "password": "Password123",
    "confirmPassword": "Password123",
    "acceptTerms": true
  }'
```

### 2. Verify Registration OTP
*(Check the 6-digit code in Mailpit at http://localhost:8025)*
```bash
curl -X POST http://localhost:3000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "ayesha@example.com", "code": "123456"}'
```
*Response will return `accessToken`, `refreshToken`, and `"nextStep": "COMPLETE_PROFILE"`.*

### 3. Fetch Cities (To obtain `cityId`)
```bash
curl http://localhost:3000/api/v1/locations/cities?countryCode=PK
```

### 4. Upload Avatar Image
```bash
curl -X POST http://localhost:3000/api/v1/media/images \
  -H "Authorization: Bearer <accessToken>" \
  -F "purpose=AVATAR" \
  -F "file=@/path/to/avatar.jpg"
```
*Returns `{ id: "<media-id>", url: "..." }`.*

### 5. Complete Customer Profile
```bash
curl -X PATCH http://localhost:3000/api/v1/auth/profile/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "dateOfBirth": "1998-05-20",
    "phone": "0300 1234567",
    "gender": "FEMALE",
    "countryCode": "PK",
    "cityId": "<city-id-from-step-3>",
    "avatarId": "<media-id-from-step-4>"
  }'
```
*Response will return an updated `accessToken` with `pc: true` and `"nextStep": "HOME"`.*

### 6. Login as Platform Admin
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@salon.local",
    "password": "<admin_password_from_env>",
    "role": "ADMIN"
  }'
```

### 7. User Profile Management & Account Deletion
```bash
# Get logged in user profile
curl http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer <accessToken>"

# Edit profile (name, phone, city, DOB, avatar)
curl -X PATCH http://localhost:3000/api/v1/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"fullName": "Ayesha Khan Updated", "phone": "0300 9876543"}'

# Delete Account (Apple & Google Play Store Compliance)
curl -X DELETE http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <accessToken>"
```

### 8. Multi-Branch Owner Onboarding Flow
```bash
# Check onboarding state
curl http://localhost:3000/api/v1/owner/onboarding \
  -H "Authorization: Bearer <ownerAccessToken>"

# Step 1: Save Brand & First Branch Location with 1-3 Images
curl -X POST http://localhost:3000/api/v1/owner/onboarding/step1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ownerAccessToken>" \
  -d '{
    "brandName": "Lavish Salon",
    "brandBio": "Premium beauty services across Pakistan",
    "branchName": "Safoora Branch",
    "phone": "0300 1122334",
    "addressLine": "Shop 12, Commercial Area",
    "cityId": "<city-id>",
    "type": "LADIES",
    "imageIds": ["<media-id-1>"]
  }'

# Step 3: Save Working Hours
curl -X POST http://localhost:3000/api/v1/owner/branches/<branchId>/hours \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ownerAccessToken>" \
  -d '{
    "hours": [
      { "day": "MONDAY", "opensAtMin": 600, "closesAtMin": 1260 },
      { "day": "TUESDAY", "opensAtMin": 600, "closesAtMin": 1260 },
      { "day": "WEDNESDAY", "opensAtMin": 600, "closesAtMin": 1260 },
      { "day": "THURSDAY", "opensAtMin": 600, "closesAtMin": 1260 },
      { "day": "FRIDAY", "opensAtMin": 900, "closesAtMin": 1320 },
      { "day": "SATURDAY", "opensAtMin": 600, "closesAtMin": 1320 }
    ]
  }'

# Submit Branch for Admin Approval
curl -X POST http://localhost:3000/api/v1/owner/branches/<branchId>/submit \
  -H "Authorization: Bearer <ownerAccessToken>"
```

### 9. Platform Admin Moderation
```bash
# List all pending branches
curl http://localhost:3000/api/v1/admin/branches/pending \
  -H "Authorization: Bearer <adminAccessToken>"

# Approve Branch
curl -X POST http://localhost:3000/api/v1/admin/branches/<branchId>/approve \
  -H "Authorization: Bearer <adminAccessToken>"

# Reject Branch with Reason
curl -X POST http://localhost:3000/api/v1/admin/branches/<branchId>/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <adminAccessToken>" \
  -d '{"reason": "Images are unclear. Please upload high resolution salon photos."}'

# Mark Brand as Trusted (New branches will auto-approve)
curl -X POST http://localhost:3000/api/v1/admin/brands/<brandId>/trust \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <adminAccessToken>" \
  -d '{"isTrusted": true, "maxBranches": 30}'
```

### 10. Automated End-to-End Test Suite
Run the full 20-point automated E2E test suite covering Health, Locations, Customer, Owner, Admin, and RBAC:
```bash
npm run test:e2e
```

---

## 12. Upcoming Milestones (Roadmap)

- [x] **Sprint 1 (Part 1 & 2):** Foundation, Password Authentication with Email OTP Verification & Reset, JWT Rotation, Google/Apple OAuth, Web Cookies, Profile Completion, Cities.
- [x] **Sprint 2 (Part 1):** Multi-Branch & Brand Schema, Media/S3 Service with Sharp WebP strip EXIF, Admin Seed, Customer Avatar integration.
- [x] **Sprint 2 (Part 2):**
  - Multi-Branch Owner Onboarding Step 1 (Brand + First Branch + 1-3 Images).
  - Step 3 (Branch Working Hours).
  - Submission for Admin Approval workflow.
  - Platform Admin moderation APIs (Pending list, Approve, Reject with reason, Trust brand).
  - Users Profile Edit & Account Deletion (Apple/Google Play store compliance).
  - Health check endpoint (`GET /api/v1/health` with DB query ping).
  - Reverse Proxy (`trust proxy`) & Global Exception Filter (`HttpExceptionFilter`).
  - Automated 20-point End-to-End test suite (`npm run test:e2e`).
- [ ] **Sprint 2 (Part 3):** Service Categories seed, Brand Catalog Services, Branch price/duration overrides, Deals & Packages.
- [ ] **Hardening Tasks:**
  - Redis integration for Throttler (`@nest-lab/throttler-storage-redis` / `ioredis`).
  - Cleanup Cron Job (expired OTP codes, unused S3 media assets).
  - BullMQ integration for background email queue.
- [ ] **Sprint 3:** Staff Management, Working Schedules, Service assignments, Leaves.
- [ ] **Sprint 4:** High-Concurrency Availability & Slot Booking Engine (Distributed Locking & Double Booking Prevention).
- [ ] **Sprint 5:** Pakistan Payments (Cash, JazzCash, Easypaisa, Raast, PayFast).

