import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaClient, Role, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

const SINDH = 'Sindh';
const PUNJAB = 'Punjab';
const KP = 'Khyber Pakhtunkhwa';
const BALOCHISTAN = 'Balochistan';

const cities: Array<[string, string]> = [
  ['Karachi', SINDH], ['Hyderabad', SINDH], ['Sukkur', SINDH], ['Larkana', SINDH],
  ['Mirpur Khas', SINDH], ['Nawabshah', SINDH],
  ['Lahore', PUNJAB], ['Faisalabad', PUNJAB], ['Rawalpindi', PUNJAB], ['Multan', PUNJAB],
  ['Gujranwala', PUNJAB], ['Sialkot', PUNJAB], ['Bahawalpur', PUNJAB], ['Sargodha', PUNJAB],
  ['Sahiwal', PUNJAB], ['Gujrat', PUNJAB], ['Sheikhupura', PUNJAB],
  ['Islamabad', 'Islamabad Capital Territory'],
  ['Peshawar', KP], ['Mardan', KP], ['Abbottabad', KP], ['Mingora', KP], ['Kohat', KP],
  ['Quetta', BALOCHISTAN], ['Gwadar', BALOCHISTAN], ['Turbat', BALOCHISTAN],
  ['Muzaffarabad', 'Azad Jammu & Kashmir'], ['Mirpur', 'Azad Jammu & Kashmir'],
  ['Gilgit', 'Gilgit-Baltistan'],
];

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set: admin seed skipped');
    return;
  }
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  if (await prisma.user.findUnique({ where: { email } })) return; // dobara password overwrite nahi

  const now = new Date();
  await prisma.user.create({
    data: {
      email,
      fullName: 'Platform Admin',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      emailVerifiedAt: now,
      termsAcceptedAt: now,
      termsVersion: 'seed',
      profileCompletedAt: now,
    },
  });
  console.log(`✅ Seeded admin user: ${email}`);
}

async function main() {
  for (const [name, province] of cities) {
    await prisma.city.upsert({
      where: { countryCode_name: { countryCode: 'PK', name } },
      update: { province },
      create: { name, province, countryCode: 'PK' },
    });
  }
  console.log(`✅ Seeded ${cities.length} cities successfully.`);
  await seedAdmin();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
