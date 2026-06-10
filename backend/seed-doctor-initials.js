const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const mapByCode = {
  'D184': 'HB', // Prof Habibah
  'D185': 'BD', // Prof Budu
  'D187': 'HL', // dr Halimah
  'D188': 'AR', // dr A. Rukmini
  'D189': 'RT', // dr Rahasiah
  'D190': 'HZ', // dr Hamzah
  'D191': 'MA', // dr Mirella
  'D192': 'JD', // dr Junaedi
  'D193': 'AJ', // dr Azizah
  'D194': 'NS', // Dr Noor Syamsu
  'D195': 'YT', // Dr Yunita
  'D196': 'ST', // dr Sitti Soraya
  'D198': 'MT', // Dr Marlyanti
  'D200': 'AL', // dr Adelina
  'D211': 'SY', // dr A. Suryanita
  'D213': 'WN', // dr Dyah Ayu Windy
  'D214': 'RP', // dr Rani
  'D215': 'IP', // dr Muh Irfan
  'D216': 'TW', // dr Andi Pratiwi
  'D217': 'FL', // dr Andi Akhmad Faisal
  'D218': 'RR', // dr Ririn
  'D219': 'AB', // dr Muh Abrar
  'D221': 'HS', // Dr Hasnah Eka
  'D222': 'BT', // Dr Batari Todja
  'D289': 'FD', // dr Fadhlullah
  'D290': 'SN', // dr Sultan
  'D303': 'IM', // dr Nur Aulia
  'D304': 'MC', // dr Marco
  'D305': 'RD', // dr Ardy
  'D316': 'MB', // dr Melia
  'D317': 'MY', // dr Meiliana
  'D318': 'TR', // dr Mentari
  'D323': 'MR', // dr Hanna
  'D324': 'VR', // dr Vita
  'D345': 'LO', // dr La Ode
  'D357': 'DW', // Dr Dewi
  'D367': 'FF', // dr Ahdini Zulfiana (Andini)
  'D402': 'GR', // dr George
  'D407': 'CN', // dr Cindy
  'D408': 'MU', // dr Nurul Muthia
};

async function main() {
  for (const [code, alias] of Object.entries(mapByCode)) {
    await prisma.$executeRaw`UPDATE doctors SET doctor_initials = ${alias} WHERE doctor_code = ${code}`;
    console.log(`Assigned alias ${alias} to doctor code ${code}`);
  }

  // Adding NR (Andi Anissa Rahmadani Dahrif) because she was missing from the first list
  await prisma.doctor.upsert({
    where: { doctorCode: 'D999NR' }, // Assuming arbitrary code since it wasn't in original image
    update: {
      doctorName: 'dr. Andi Anissa Rahmadani Dahrif., Sp.PD',
      doctorInitials: 'NR',
      specialty: 'Penyakit Dalam'
    },
    create: {
      doctorCode: 'D999NR',
      doctorName: 'dr. Andi Anissa Rahmadani Dahrif., Sp.PD',
      doctorInitials: 'NR',
      specialty: 'Penyakit Dalam'
    }
  });
  console.log('Assigned alias NR to D999NR (dr. Andi Anissa)');

  console.log('Update initials selesai dengan akurat!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
