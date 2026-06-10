const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const localDoctors = [
  {
    "doctorCode": "D001",
    "doctorName": "dr. Andi Pratama, Sp.M",
    "doctorInitials": null,
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D002",
    "doctorName": "dr. Budi Santoso, Sp.PD",
    "doctorInitials": null,
    "specialty": "Penyakit Dalam",
    "isActive": true
  },
  {
    "doctorCode": "D003",
    "doctorName": "dr. Citra Dewi, Sp.OG",
    "doctorInitials": null,
    "specialty": "Obstetri & Ginekologi",
    "isActive": true
  },
  {
    "doctorCode": "D004",
    "doctorName": "dr. Dian Sari, Sp.KK",
    "doctorInitials": null,
    "specialty": "Kulit & Kelamin",
    "isActive": true
  },
  {
    "doctorCode": "D005",
    "doctorName": "dr. Eko Wijaya, Sp.THT",
    "doctorInitials": null,
    "specialty": "THT",
    "isActive": true
  },
  {
    "doctorCode": "D006",
    "doctorName": "dr. Fina Rahma, Sp.JP",
    "doctorInitials": null,
    "specialty": "Jantung",
    "isActive": true
  },
  {
    "doctorCode": "D007",
    "doctorName": "dr. Gani Putra, Sp.B",
    "doctorInitials": null,
    "specialty": "Bedah",
    "isActive": true
  },
  {
    "doctorCode": "D008",
    "doctorName": "dr. Hana Melati, Sp.A",
    "doctorInitials": null,
    "specialty": "Anak",
    "isActive": true
  },
  {
    "doctorCode": "D009",
    "doctorName": "dr. Irfan Hakim, Sp.S",
    "doctorInitials": "IP",
    "specialty": "Saraf",
    "isActive": true
  },
  {
    "doctorCode": "D010",
    "doctorName": "dr. Joko Susilo, Sp.U",
    "doctorInitials": null,
    "specialty": "Urologi",
    "isActive": true
  },
  {
    "doctorCode": "D184",
    "doctorName": "Prof. Dr. dr. Habibah Setyawati Muhiddin, Sp.M(K)",
    "doctorInitials": "HB",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D185",
    "doctorName": "Prof. dr. Budu, Ph.D., Sp.M(K)., M.Med.Ed",
    "doctorInitials": "BD",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D186",
    "doctorName": "dr. Suliati P. Amir, Sp.M., M.Med.Ed",
    "doctorInitials": null,
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D187",
    "doctorName": "dr. Halimah Pagarra, Sp.M(K)",
    "doctorInitials": "HL",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D188",
    "doctorName": "dr. Andi Rukmini Fachry, Sp.M",
    "doctorInitials": "AR",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D189",
    "doctorName": "dr. Rahasiah Taufik, Sp.M(K)",
    "doctorInitials": "RT",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D190",
    "doctorName": "dr. Hamzah, Sp.M(K)",
    "doctorInitials": "HZ",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D191",
    "doctorName": "dr. Mirella Afifudin, Sp.M., M.Kes",
    "doctorInitials": "MA",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D192",
    "doctorName": "dr. Junaedi Sirajudin, Sp.M(K)",
    "doctorInitials": "JD",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D193",
    "doctorName": "dr. Azizah M. Junus, Sp.M",
    "doctorInitials": "AJ",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D194",
    "doctorName": "Dr. dr. Noor Syamsu, Sp.M(K)., M.Kes (MARS)",
    "doctorInitials": "NS",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D195",
    "doctorName": "Dr. dr. Yunita, Sp.M(K)., M.Kes",
    "doctorInitials": "YT",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D196",
    "doctorName": "dr. Sitti Soraya Taufik, Sp.M., M.Kes",
    "doctorInitials": "ST",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D197",
    "doctorName": "Prof. dr. Andi. Muhammad Ichsan, Ph.D., Sp.M(K)",
    "doctorInitials": null,
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D198",
    "doctorName": "Dr. dr. Marlyanti Nur Rahmah, Sp.M(K)., M.Kes., MHPE., FFRI",
    "doctorInitials": "MT",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D199",
    "doctorName": "Dr. dr. Andi. Tenrisanna Devi Indira, Sp.M(K)., MARS",
    "doctorInitials": null,
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D200",
    "doctorName": "dr. Adelina Titirina. Poli, Sp.M., M.Kes",
    "doctorInitials": "AL",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D201",
    "doctorName": "Dr. dr. Rachmawati Adiputri Muhiddin, Sp.PK(K)",
    "doctorInitials": null,
    "specialty": "Patologi Klinik",
    "isActive": true
  },
  {
    "doctorCode": "D202",
    "doctorName": "dr. Romy Hefta Mulya, Sp.An-TI",
    "doctorInitials": null,
    "specialty": "Anestesi",
    "isActive": true
  },
  {
    "doctorCode": "D203",
    "doctorName": "Dr. dr. Andi Salahuddin, Sp.An-TI., Subsp. An.R(K)",
    "doctorInitials": null,
    "specialty": "Anestesi",
    "isActive": true
  },
  {
    "doctorCode": "D204",
    "doctorName": "dr. Andi Amirah Shaleha Junaedi, MARS",
    "doctorInitials": null,
    "specialty": "Umum",
    "isActive": true
  },
  {
    "doctorCode": "D211",
    "doctorName": "dr. Andi Suryanita Tajuddin, Sp.M",
    "doctorInitials": "SY",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D212",
    "doctorName": "dr. Idayani Panggalo, Sp.M",
    "doctorInitials": null,
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D213",
    "doctorName": "dr. Dyah Ayu Windyasara Putri, Sp.M",
    "doctorInitials": "WN",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D214",
    "doctorName": "dr. Rani Yunita Patong, Sp.M",
    "doctorInitials": "RP",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D215",
    "doctorName": "dr. Muhammad Irfan, M.Kes., Sp.M., M.HPE., FIACLE",
    "doctorInitials": "IP",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D216",
    "doctorName": "dr. Andi Pratiwi, Sp.M., M.Kes",
    "doctorInitials": "TW",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D217",
    "doctorName": "dr. Andi Akhmad Faisal, M.Kes., Sp.M",
    "doctorInitials": "FL",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D218",
    "doctorName": "dr. Ririn Nislawati, Sp.M(K)., M.Kes",
    "doctorInitials": "RR",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D219",
    "doctorName": "dr. Muh. Abrar Ismail, Sp.M(K)., M.Kes",
    "doctorInitials": "AB",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D220",
    "doctorName": "Dr. dr. Ahmad Ashraf Amalius, Sp.M(K)., M.Kes",
    "doctorInitials": null,
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D221",
    "doctorName": "Dr. dr. Hasnah Eka, Sp.M(K)., M.Kes",
    "doctorInitials": "HS",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D222",
    "doctorName": "Dr. dr. Batari Todja Umar, Sp.M(K)",
    "doctorInitials": "BT",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D260",
    "doctorName": "dr. Ratih Natasha Maharani, Sp.M(K)., M.Kes",
    "doctorInitials": null,
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D289",
    "doctorName": "dr. Fadhlullah Latama, Sp.M",
    "doctorInitials": "FD",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D290",
    "doctorName": "dr. Sultan Hasanuddin, Sp.M",
    "doctorInitials": "SN",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D303",
    "doctorName": "dr. Nur Aulia, Sp.M",
    "doctorInitials": "IM",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D304",
    "doctorName": "dr. Marco Angelo Liwan, Sp.M",
    "doctorInitials": "MC",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D305",
    "doctorName": "dr. Ardy Gisnawan, M.Kes (MARS)., Sp.M",
    "doctorInitials": "RD",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D316",
    "doctorName": "dr. Melia Budi Astuti, Sp.M",
    "doctorInitials": "MB",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D317",
    "doctorName": "dr. Meiliana Lay, Sp.M",
    "doctorInitials": "MY",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D318",
    "doctorName": "dr. Mentari Nurul Mutmainnah, Sp.M",
    "doctorInitials": "TR",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D323",
    "doctorName": "dr. Hanna Aulia Namirah, Sp.M",
    "doctorInitials": "MR",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D324",
    "doctorName": "dr. Vita Rahayu, Sp.M",
    "doctorInitials": "VR",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D335",
    "doctorName": "dr. Andi Anissa Rahmadani Dahrif., Sp.PD",
    "doctorInitials": "NR",
    "specialty": "-",
    "isActive": true
  },
  {
    "doctorCode": "D336",
    "doctorName": "dr. Dian Eka Saputri, MARS",
    "doctorInitials": null,
    "specialty": "Umum",
    "isActive": true
  },
  {
    "doctorCode": "D337",
    "doctorName": "dr. Nurul Anita Putri",
    "doctorInitials": null,
    "specialty": "Umum",
    "isActive": true
  },
  {
    "doctorCode": "D338",
    "doctorName": "dr. Nur Madinah Siregar",
    "doctorInitials": null,
    "specialty": "Umum",
    "isActive": true
  },
  {
    "doctorCode": "D339",
    "doctorName": "dr. Muhammad Alim Abdillah",
    "doctorInitials": null,
    "specialty": "Umum",
    "isActive": true
  },
  {
    "doctorCode": "D340",
    "doctorName": "dr. Andik Subagiyo",
    "doctorInitials": null,
    "specialty": "Umum",
    "isActive": true
  },
  {
    "doctorCode": "D343",
    "doctorName": "dr. Alifiah Putri Baharuddin, M.Kes",
    "doctorInitials": null,
    "specialty": "Umum",
    "isActive": true
  },
  {
    "doctorCode": "D345",
    "doctorName": "dr. La Ode Hamzah Rachmat, Sp.M",
    "doctorInitials": "LO",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D357",
    "doctorName": "dr. Dewi Nugrahwati Putri, Sp.M",
    "doctorInitials": "DW",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D366",
    "doctorName": "dr. Irna Diyana Kartika Kamaluddin, Sp.PK., M.Kes., Ph.D",
    "doctorInitials": null,
    "specialty": "Patologi Klinik",
    "isActive": true
  },
  {
    "doctorCode": "D367",
    "doctorName": "dr. Ahdini Zulfiana Abidin, M.Sc., Sp.M",
    "doctorInitials": "FF",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D402",
    "doctorName": "dr. George Ade Novra Sitanaya, Sp.M",
    "doctorInitials": "GR",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D407",
    "doctorName": "dr. Cindy Hartono, Sp.M",
    "doctorInitials": "CN",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D408",
    "doctorName": "dr. Nurul Muthia Alviani, Sp.M",
    "doctorInitials": "MU",
    "specialty": "Mata",
    "isActive": true
  },
  {
    "doctorCode": "D999NR",
    "doctorName": "dr. Andi Anissa Rahmadani Dahrif., Sp.PD",
    "doctorInitials": "NR",
    "specialty": "Penyakit Dalam",
    "isActive": true
  }
];

async function main() {
  console.log('Memulai sinkronisasi master dokter lokal ke server...');
  
  for (const doc of localDoctors) {
    await prisma.doctor.upsert({
      where: { doctorCode: doc.doctorCode },
      update: {
        doctorName: doc.doctorName,
        doctorInitials: doc.doctorInitials,
        specialty: doc.specialty,
        isActive: doc.isActive
      },
      create: {
        doctorCode: doc.doctorCode,
        doctorName: doc.doctorName,
        doctorInitials: doc.doctorInitials,
        specialty: doc.specialty,
        isActive: doc.isActive
      }
    });
    console.log(`Upserted Doctor: ${doc.doctorCode} - ${doc.doctorName}`);
  }
  
  console.log('Sinkronisasi master dokter selesai!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
