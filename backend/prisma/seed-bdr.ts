import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting BDR users seed...');

  const bdrUsers = [
    { name: 'Rolando Mardi Putra, A.Md.RO, SKM', nik: '21445' },
    { name: 'Adithia Budiman, A.Md.RO, SKM COI', nik: '21500' },
    { name: 'Wahyudi Ardiansyah, A.Md.RO', nik: '21912' },
    { name: 'Wahidah P, A.Md.Kes', nik: '21911' },
    { name: 'Rahmad Cahyadin, A.Md.RO', nik: '22142' },
    { name: 'Yeyen Prisma, A.Md.Kes', nik: '21934' },
    { name: 'Melisa Abdullah, A.Md.Kes', nik: '22121' },
    { name: 'Febriel Sevdy, A.Md.Kes', nik: '22175' },
  ];

  for (const u of bdrUsers) {
    const pwdHash = await bcrypt.hash(u.nik, 10);
    await prisma.user.upsert({
      where: { email: u.nik },
      update: {
        name: u.name,
        passwordHash: pwdHash,
        role: 'BDR',
      },
      create: {
        name: u.name,
        email: u.nik,
        passwordHash: pwdHash,
        role: 'BDR',
      },
    });
    console.log(`✅ Processed user: ${u.name}`);
  }

  console.log('🎉 BDR Users seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
