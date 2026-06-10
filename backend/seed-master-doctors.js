const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const rawDoctors = [
  { code: 'D184', name: 'Prof. Dr. dr. Habibah Setyawati Muhiddin, Sp.M(K)' },
  { code: 'D185', name: 'Prof. dr. Budu, Ph.D., Sp.M(K)., M.Med.Ed' },
  { code: 'D186', name: 'dr. Suliati P. Amir, Sp.M., M.Med.Ed' },
  { code: 'D187', name: 'dr. Halimah Pagarra, Sp.M(K)' },
  { code: 'D188', name: 'dr. Andi Rukmini Fachry, Sp.M' },
  { code: 'D189', name: 'dr. Rahasiah Taufik, Sp.M(K)' },
  { code: 'D190', name: 'dr. Hamzah, Sp.M(K)' },
  { code: 'D191', name: 'dr. Mirella Afifudin, Sp.M., M.Kes' },
  { code: 'D192', name: 'dr. Junaedi Sirajudin, Sp.M(K)' },
  { code: 'D193', name: 'dr. Azizah M. Junus, Sp.M' },
  { code: 'D194', name: 'Dr. dr. Noor Syamsu, Sp.M(K)., M.Kes (MARS)' },
  { code: 'D195', name: 'Dr. dr. Yunita, Sp.M(K)., M.Kes' },
  { code: 'D196', name: 'dr. Sitti Soraya Taufik, Sp.M., M.Kes' },
  { code: 'D197', name: 'Prof. dr. Andi. Muhammad Ichsan, Ph.D., Sp.M(K)' },
  { code: 'D198', name: 'Dr. dr. Marlyanti Nur Rahmah, Sp.M(K)., M.Kes., MHPE., FFRI' },
  { code: 'D199', name: 'Dr. dr. Andi. Tenrisanna Devi Indira, Sp.M(K)., MARS' },
  { code: 'D200', name: 'dr. Adelina Titirina. Poli, Sp.M., M.Kes' },
  { code: 'D201', name: 'Dr. dr. Rachmawati Adiputri Muhiddin, Sp.PK(K)' },
  { code: 'D202', name: 'dr. Romy Hefta Mulya, Sp.An-TI' },
  { code: 'D203', name: 'Dr. dr. Andi Salahuddin, Sp.An-TI., Subsp. An.R(K)' },
  { code: 'D204', name: 'dr. Andi Amirah Shaleha Junaedi, MARS' },
  { code: 'D211', name: 'dr. Andi Suryanita Tajuddin, Sp.M' },
  { code: 'D212', name: 'dr. Idayani Panggalo, Sp.M' },
  { code: 'D213', name: 'dr. Dyah Ayu Windyasara Putri, Sp.M' },
  { code: 'D214', name: 'dr. Rani Yunita Patong, Sp.M' },
  { code: 'D215', name: 'dr. Muhammad Irfan, M.Kes., Sp.M., M.HPE., FIACLE' },
  { code: 'D216', name: 'dr. Andi Pratiwi, Sp.M., M.Kes' },
  { code: 'D217', name: 'dr. Andi Akhmad Faisal, M.Kes., Sp.M' },
  { code: 'D218', name: 'dr. Ririn Nislawati, Sp.M(K)., M.Kes' },
  { code: 'D219', name: 'dr. Muh. Abrar Ismail, Sp.M(K)., M.Kes' },
  { code: 'D220', name: 'Dr. dr. Ahmad Ashraf Amalius, Sp.M(K)., M.Kes' },
  { code: 'D221', name: 'Dr. dr. Hasnah Eka, Sp.M(K)., M.Kes' },
  { code: 'D222', name: 'Dr. dr. Batari Todja Umar, Sp.M(K)' },
  { code: 'D260', name: 'dr. Ratih Natasha Maharani, Sp.M(K)., M.Kes' },
  { code: 'D289', name: 'dr. Fadhlullah Latama, Sp.M' },
  { code: 'D290', name: 'dr. Sultan Hasanuddin, Sp.M' },
  { code: 'D303', name: 'dr. Nur Aulia, Sp.M' },
  { code: 'D304', name: 'dr. Marco Angelo Liwan, Sp.M' },
  { code: 'D305', name: 'dr. Ardy Gisnawan, M.Kes (MARS)., Sp.M' },
  { code: 'D316', name: 'dr. Melia Budi Astuti, Sp.M' },
  { code: 'D317', name: 'dr. Meiliana Lay, Sp.M' },
  { code: 'D318', name: 'dr. Mentari Nurul Mutmainnah, Sp.M' },
  { code: 'D323', name: 'dr. Hanna Aulia Namirah, Sp.M' },
  { code: 'D324', name: 'dr. Vita Rahayu, Sp.M' },
  { code: 'D336', name: 'dr. Dian Eka Saputri, MARS' },
  { code: 'D337', name: 'dr. Nurul Anita Putri' },
  { code: 'D338', name: 'dr. Nur Madinah Siregar' },
  { code: 'D339', name: 'dr. Muhammad Alim Abdillah' },
  { code: 'D340', name: 'dr. Andik Subagiyo' },
  { code: 'D343', name: 'dr. Alifiah Putri Baharuddin, M.Kes' },
  { code: 'D345', name: 'dr. La Ode Hamzah Rachmat, Sp.M' },
  { code: 'D357', name: 'dr. Dewi Nugrahwati Putri, Sp.M' },
  { code: 'D366', name: 'dr. Irna Diyana Kartika Kamaluddin, Sp.PK., M.Kes., Ph.D' },
  { code: 'D367', name: 'dr. Ahdini Zulfiana Abidin, M.Sc., Sp.M' },
  { code: 'D402', name: 'dr. George Ade Novra Sitanaya, Sp.M' },
  { code: 'D407', name: 'dr. Cindy Hartono, Sp.M' },
  { code: 'D408', name: 'dr. Nurul Muthia Alviani, Sp.M' }
];

function getSpecialty(name) {
  if (name.includes('Sp.M')) return 'Mata';
  if (name.includes('Sp.PK')) return 'Patologi Klinik';
  if (name.includes('Sp.An')) return 'Anestesi';
  return 'Umum';
}

async function main() {
  for (const doc of rawDoctors) {
    const specialty = getSpecialty(doc.name);
    
    await prisma.doctor.upsert({
      where: { doctorCode: doc.code },
      update: {
        doctorName: doc.name,
        specialty: specialty,
        isActive: true
      },
      create: {
        doctorCode: doc.code,
        doctorName: doc.name,
        specialty: specialty,
        isActive: true
      }
    });
    console.log(`Upserted Doctor: ${doc.code} - ${doc.name} (${specialty})`);
  }
  console.log('Selesai update master dokter!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
