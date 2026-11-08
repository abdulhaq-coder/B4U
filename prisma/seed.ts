import { PrismaClient } from '@prisma/client';

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

async function main() {
  for (const [name, province] of cities) {
    await prisma.city.upsert({
      where: { countryCode_name: { countryCode: 'PK', name } },
      update: { province },
      create: { name, province, countryCode: 'PK' },
    });
  }
  console.log(`✅ Seeded ${cities.length} cities successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
