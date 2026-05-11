import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ========================
  // 1. FLOORS
  // ========================
  const floor5 = await prisma.floor.create({
    data: { floorNumber: 5, name: 'Lantai 5' },
  });
  const floor6 = await prisma.floor.create({
    data: { floorNumber: 6, name: 'Lantai 6' },
  });
  const floor7 = await prisma.floor.create({
    data: { floorNumber: 7, name: 'Lantai 7' },
  });
  console.log('✅ Floors created');

  // ========================
  // 2. DISPLAYS
  // ========================
  const displayAdmisi = await prisma.display.create({
    data: {
      code: 'display_admisi',
      name: 'TV Admisi',
      displayType: 'ADMISSION',
      orientation: 'PORTRAIT',
      runningText: 'Selamat datang di Klinik Orbita. Mohon menunggu nomor antrian Anda dipanggil.',
    },
  });
  const displayKasir = await prisma.display.create({
    data: {
      code: 'display_kasir',
      name: 'TV Kasir',
      displayType: 'CASHIER',
      orientation: 'PORTRAIT',
      runningText: 'Silakan menuju counter kasir yang ditunjukkan di layar.',
    },
  });
  const displayLt5 = await prisma.display.create({
    data: {
      code: 'display_lantai_5',
      name: 'TV Lantai 5',
      displayType: 'FLOOR',
      floorId: floor5.id,
      orientation: 'LANDSCAPE',
      runningText: 'Lantai 5 - Silakan menunggu nomor antrian Anda dipanggil.',
    },
  });
  const displayLt6 = await prisma.display.create({
    data: {
      code: 'display_lantai_6',
      name: 'TV Lantai 6',
      displayType: 'FLOOR',
      floorId: floor6.id,
      orientation: 'LANDSCAPE',
      runningText: 'Lantai 6 - Silakan menunggu nomor antrian Anda dipanggil.',
    },
  });
  const displayLt7 = await prisma.display.create({
    data: {
      code: 'display_lantai_7',
      name: 'TV Lantai 7',
      displayType: 'FLOOR',
      floorId: floor7.id,
      orientation: 'LANDSCAPE',
      runningText: 'Lantai 7 - Silakan menunggu nomor antrian Anda dipanggil.',
    },
  });
  const displayFarmasi = await prisma.display.create({
    data: {
      code: 'display_farmasi',
      name: 'TV Farmasi',
      displayType: 'PHARMACY',
      orientation: 'LANDSCAPE',
      runningText: 'Farmasi - Silakan menunggu obat Anda disiapkan.',
    },
  });
  console.log('✅ Displays created');

  // ========================
  // 3. ROOMS
  // ========================
  // BDR rooms
  await prisma.room.createMany({
    data: [
      { code: 'BDR5', name: 'BDR Lantai 5', roomType: 'BDR', floorId: floor5.id, hasCalling: true, displayId: displayLt5.id },
      { code: 'BDR6', name: 'BDR Lantai 6', roomType: 'BDR', floorId: floor6.id, hasCalling: true, displayId: displayLt6.id },
      { code: 'BDR7', name: 'BDR Lantai 7', roomType: 'BDR', floorId: floor7.id, hasCalling: true, displayId: displayLt7.id },
    ],
  });

  // Poli lantai 5
  await prisma.room.createMany({
    data: [
      { code: '5A', name: 'Poli 5A', roomType: 'DOCTOR', floorId: floor5.id, hasCalling: true, displayId: displayLt5.id },
      { code: '5B', name: 'Poli 5B', roomType: 'DOCTOR', floorId: floor5.id, hasCalling: true, displayId: displayLt5.id },
      { code: '5C', name: 'Poli 5C', roomType: 'DOCTOR', floorId: floor5.id, hasCalling: true, displayId: displayLt5.id },
      { code: '5D', name: 'Poli 5D', roomType: 'DOCTOR', floorId: floor5.id, hasCalling: true, displayId: displayLt5.id },
      { code: '5E', name: 'Poli 5E', roomType: 'DOCTOR', floorId: floor5.id, hasCalling: true, displayId: displayLt5.id },
    ],
  });

  // Poli lantai 6
  await prisma.room.createMany({
    data: [
      { code: '6A', name: 'Poli 6A', roomType: 'DOCTOR', floorId: floor6.id, hasCalling: true, displayId: displayLt6.id },
      { code: '6B', name: 'Poli 6B', roomType: 'DOCTOR', floorId: floor6.id, hasCalling: true, displayId: displayLt6.id },
      { code: '6C', name: 'Poli 6C', roomType: 'DOCTOR', floorId: floor6.id, hasCalling: true, displayId: displayLt6.id },
      { code: '6D', name: 'Poli 6D', roomType: 'DOCTOR', floorId: floor6.id, hasCalling: true, displayId: displayLt6.id },
      { code: '6E', name: 'Poli 6E', roomType: 'DOCTOR', floorId: floor6.id, hasCalling: true, displayId: displayLt6.id },
    ],
  });

  // Special rooms
  await prisma.room.createMany({
    data: [
      { code: 'CDC6', name: 'CDC Lantai 6', roomType: 'CDC', floorId: floor6.id, hasCalling: false },
      { code: 'ANAK7', name: 'Poli Anak Lantai 7', roomType: 'DOCTOR_CHILD', floorId: floor7.id, hasCalling: true, displayId: displayLt7.id },
      { code: 'ADMISI', name: 'Admisi', roomType: 'ADMISSION', hasCalling: true, displayId: displayAdmisi.id },
      { code: 'KASIR', name: 'Kasir', roomType: 'CASHIER', hasCalling: true, displayId: displayKasir.id },
      { code: 'FARMASI', name: 'Farmasi', roomType: 'PHARMACY', hasCalling: true, displayId: displayFarmasi.id },
      { code: 'OPTIK', name: 'Optik', roomType: 'OPTIC', hasCalling: false },
    ],
  });
  console.log('✅ Rooms created');

  // ========================
  // 4. COUNTERS
  // ========================
  await prisma.counter.createMany({
    data: [
      { code: 'C1', name: 'Counter 1', canHandleAdmission: true, canHandleCashier: true },
      { code: 'C2', name: 'Counter 2', canHandleAdmission: true, canHandleCashier: true },
      { code: 'C3', name: 'Counter 3', canHandleAdmission: true, canHandleCashier: true },
      { code: 'C4', name: 'Counter 4', canHandleAdmission: true, canHandleCashier: true },
      { code: 'C5', name: 'Counter 5', canHandleAdmission: true, canHandleCashier: true },
      { code: 'C6', name: 'Counter 6', canHandleAdmission: true, canHandleCashier: true },
    ],
  });
  console.log('✅ Counters created');

  // ========================
  // 5. ADMIN USER
  // ========================
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      name: 'Administrator',
      email: 'admin@orbita.com',
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
  });

  // Create sample users for each role
  const roles = [
    { name: 'Petugas Admisi', email: 'admisi@orbita.com', role: 'ADMISSION' as const },
    { name: 'Petugas Kasir', email: 'kasir@orbita.com', role: 'CASHIER' as const },
    { name: 'Petugas Pengkajian', email: 'assessment@orbita.com', role: 'ASSESSMENT' as const },
    { name: 'Petugas BDR', email: 'bdr@orbita.com', role: 'BDR' as const },
    { name: 'Petugas Dokter', email: 'doctor@orbita.com', role: 'DOCTOR' as const },
    { name: 'Petugas CDC', email: 'cdc@orbita.com', role: 'CDC' as const },
    { name: 'Petugas Farmasi', email: 'farmasi@orbita.com', role: 'PHARMACY' as const },
    { name: 'Petugas Optik', email: 'optik@orbita.com', role: 'OPTIC' as const },
    { name: 'Manajemen', email: 'manajemen@orbita.com', role: 'MANAGEMENT' as const },
  ];

  for (const r of roles) {
    await prisma.user.create({
      data: {
        name: r.name,
        email: r.email,
        passwordHash: hashedPassword,
        role: r.role,
      },
    });
  }
  console.log('✅ Users created');

  // ========================
  // 6. SAMPLE DOCTORS
  // ========================
  const rooms = await prisma.room.findMany();
  const roomMap = Object.fromEntries(rooms.map(r => [r.code, r.id]));

  const doctors = [
    { doctorCode: 'D001', doctorName: 'dr. Andi Pratama, Sp.M', specialty: 'Mata', room: '5A' },
    { doctorCode: 'D002', doctorName: 'dr. Budi Santoso, Sp.PD', specialty: 'Penyakit Dalam', room: '5B' },
    { doctorCode: 'D003', doctorName: 'dr. Citra Dewi, Sp.OG', specialty: 'Obstetri & Ginekologi', room: '5C' },
    { doctorCode: 'D004', doctorName: 'dr. Dian Sari, Sp.KK', specialty: 'Kulit & Kelamin', room: '6A' },
    { doctorCode: 'D005', doctorName: 'dr. Eko Wijaya, Sp.THT', specialty: 'THT', room: '6B' },
    { doctorCode: 'D006', doctorName: 'dr. Fina Rahma, Sp.JP', specialty: 'Jantung', room: '6C' },
    { doctorCode: 'D007', doctorName: 'dr. Gani Putra, Sp.B', specialty: 'Bedah', room: '6D' },
    { doctorCode: 'D008', doctorName: 'dr. Hana Melati, Sp.A', specialty: 'Anak', room: 'ANAK7' },
    { doctorCode: 'D009', doctorName: 'dr. Irfan Hakim, Sp.S', specialty: 'Saraf', room: '5D' },
    { doctorCode: 'D010', doctorName: 'dr. Joko Susilo, Sp.U', specialty: 'Urologi', room: '6E' },
  ];

  for (const d of doctors) {
    await prisma.doctor.create({
      data: {
        doctorCode: d.doctorCode,
        doctorName: d.doctorName,
        specialty: d.specialty,
        defaultRoomId: roomMap[d.room],
      },
    });
  }
  console.log('✅ Doctors created');

  // ========================
  // 7. SAMPLE SCHEDULES FOR TODAY
  // ========================
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = dayNames[today.getDay()];

  const allDoctors = await prisma.doctor.findMany({ include: { defaultRoom: true } });

  for (const doc of allDoctors) {
    if (!doc.defaultRoom) continue;
    const floor = rooms.find(r => r.id === doc.defaultRoomId);
    if (!floor) continue;

    await prisma.doctorSchedule.create({
      data: {
        scheduleDate: today,
        dayName,
        doctorId: doc.id,
        roomId: doc.defaultRoomId!,
        floorId: doc.defaultRoom.floorId!,
        startTime: '08:00',
        endTime: '14:00',
        quota: 40,
        status: 'ACTIVE',
      },
    });
  }
  console.log('✅ Schedules created for today');

  console.log('\n🎉 Seed completed successfully!');
  console.log('📧 Login: admin@orbita.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
