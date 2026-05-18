import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const users = [
  { nik: '21967', name: 'Andi Nurul Fazirah, S. E' },
  { nik: '21972', name: 'Apriliyani Hartono, S. Psi' },
  { nik: '21940', name: 'Andi Syarif Hidayatullah, S. S' },
  { nik: '22264', name: 'Eveline Ningrit Mangoting, S. Sos' },
  { nik: '21978', name: 'Fitri, S. I. Kom' },
  { nik: '22202', name: 'Muhammad Aqzan Al Gazali, S.Ak' },
  { nik: '21981', name: 'Muh Faqram Dwi Fachreza, S. IP' },
  { nik: '21999', name: 'Naadiyah Khayriyyah, SE' },
  { nik: '21913', name: 'Yurike Priska, S. A. P' },
  { nik: '21976', name: 'Camelia Indulgenssya Gundung, S.ST' },
  { nik: '21964', name: 'A. Faisal Setiawan Mus' },
  { nik: '21980', name: 'Indriani Idris, S. KM' },
];

async function main() {
  console.log('Adding users to database...');
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.nik, 10);
    try {
      await prisma.user.upsert({
        where: { email: u.nik },
        update: {
          name: u.name,
          passwordHash,
        },
        create: {
          email: u.nik,
          name: u.name,
          passwordHash,
          role: 'ADMISSION', // Default role
        }
      });
      console.log(`✅ Added user ${u.name} (NIK: ${u.nik})`);
    } catch (e: any) {
      console.error(`❌ Failed to add user ${u.nik}:`, e.message);
    }
  }
  console.log('Done! Users are now in the database.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
