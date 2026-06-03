const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const users = [
  { name: 'Suparni', nik: '21402' },
  { name: 'Ririn Nur Hidayah', nik: '21924' },
  { name: 'Nur Inayah', nik: '22316' },
  { name: 'Novia Asri Maliku', nik: '21989' },
  { name: 'Nurkumala Sinta Dewi', nik: '22288' },
  { name: 'Eka Putri Ayu', nik: '22334' },
  { name: 'Ainun Jariyah', nik: '22265' },
  { name: 'Okta Novia Lilis', nik: '21388' },
  { name: 'Megawati Burhan', nik: '21751' },
  { name: 'Alfriani farawella', nik: '22011' },
  { name: 'Maria Petronella', nik: '21902' },
  { name: 'Selvi', nik: '22289' },
  { name: 'Hariyanti', nik: '22214' },
  { name: 'Yuliana Rerung Kala\' Lembang', nik: '21997' },
  { name: 'Arini Puspita Rahman', nik: '21986' },
  { name: 'Khaeru Rijal Mulyadi', nik: '21907' },
  { name: 'Iriani Matarru', nik: '21957' },
  { name: 'Elier Langke', nik: '22315' },
  { name: 'A.Ayu Lestari', nik: '21985' },
  { name: 'Hafied Hamzah', nik: '21504' }
];

async function seed() {
  for (let u of users) {
    try {
      const hash = await bcrypt.hash(u.nik, 10);
      await prisma.user.upsert({
        where: { email: u.nik },
        update: {
          name: u.name,
          passwordHash: hash,
          role: 'DOCTOR'
        },
        create: {
          name: u.name,
          email: u.nik,
          passwordHash: hash,
          role: 'DOCTOR'
        }
      });
      console.log('Berhasil membuat akun dokter: ' + u.name);
    } catch (e) {
      console.error('Gagal membuat akun ' + u.name + ': ' + e.message);
    }
  }
}

seed().catch(console.error).finally(() => process.exit(0));
