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
  console.log('Memulai migrasi & penyamaan data dokter server...');
  
  for (const [realCode, initials] of Object.entries(mapByCode)) {
    // 1. Cari apakah ada dokter dengan code = realCode (misal D184)
    const existingReal = await prisma.doctor.findUnique({
      where: { doctorCode: realCode }
    });

    // 2. Cari apakah ada dokter dengan code = initials (misal HB)
    const existingInitial = await prisma.doctor.findUnique({
      where: { doctorCode: initials }
    });

    if (existingInitial) {
      if (existingReal) {
        // Jika dua-duanya ada (duplikat):
        // Update initials di record realCode, lalu hapus record initials agar bersih
        console.log(`Menggabungkan data: ${initials} -> ${realCode}`);
        
        // Pindahkan relasi jika ada (misal schedule atau visit)
        await prisma.doctorSchedule.updateMany({
          where: { doctorId: existingInitial.id },
          data: { doctorId: existingReal.id }
        });
        await prisma.visit.updateMany({
          where: { selectedDoctorId: existingInitial.id },
          data: { selectedDoctorId: existingReal.id }
        });
        await prisma.queueTicket.updateMany({
          where: { selectedDoctorId: existingInitial.id },
          data: { selectedDoctorId: existingReal.id }
        });

        // Update record realCode dengan initials
        await prisma.doctor.update({
          where: { id: existingReal.id },
          data: { doctorInitials: initials }
        });

        // Hapus record initials
        await prisma.doctor.delete({
          where: { id: existingInitial.id }
        });
        console.log(`Berhasil menggabungkan duplikat untuk ${initials}`);
      } else {
        // Jika hanya ada record initials (misal 'HB' ada, tapi 'D184' belum ada)
        // Cukup ubah doctorCode dari 'HB' menjadi 'D184' dan set doctorInitials = 'HB'
        await prisma.doctor.update({
          where: { id: existingInitial.id },
          data: {
            doctorCode: realCode,
            doctorInitials: initials
          }
        });
        console.log(`Mengubah kode dokter ${initials} menjadi ${realCode} dan mengisi inisial`);
      }
    } else if (existingReal) {
      // Jika record realCode ada dan initials tidak ada, cukup isi initials nya
      await prisma.doctor.update({
        where: { id: existingReal.id },
        data: { doctorInitials: initials }
      });
      console.log(`Mengisi inisial ${initials} pada kode ${realCode}`);
    } else {
      console.log(`⚠️ Dokter ${realCode} (${initials}) tidak ditemukan di database`);
    }
  }

  // Tambahkan inisial NR secara khusus
  const existingNr = await prisma.doctor.findFirst({
    where: {
      OR: [
        { doctorCode: 'NR' },
        { doctorCode: 'D999NR' }
      ]
    }
  });
  if (existingNr) {
    await prisma.doctor.update({
      where: { id: existingNr.id },
      data: {
        doctorCode: 'D999NR',
        doctorInitials: 'NR'
      }
    });
    console.log('Berhasil memetakan D999NR / NR');
  }

  console.log('Semua data dokter server berhasil diperbaiki & disamakan dengan local!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
