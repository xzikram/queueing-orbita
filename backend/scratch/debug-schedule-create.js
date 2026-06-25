const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock parseLocalDate from backend/src/common/timezone.utils
function parseLocalDate(dateInput, isEndOfDay = false) {
  let tzOffset = 8; // Default to Asia/Makassar (WITA, UTC+8)
  if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
  else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;
  
  let dateObj;
  if (dateInput instanceof Date) {
    dateObj = dateInput;
  } else {
    const str = String(dateInput).trim();
    const parts = str.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      let ms = Date.UTC(y, m, d) - (tzOffset * 60 * 60 * 1000);
      if (isEndOfDay) {
        ms += (24 * 60 * 60 * 1000) - 1;
      }
      return new Date(ms);
    }
    dateObj = new Date(str);
  }

  if (isNaN(dateObj.getTime())) {
    return dateObj;
  }

  const localTime = dateObj.getTime() + (tzOffset * 60 * 60 * 1000);
  const localDate = new Date(localTime);
  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth();
  const day = localDate.getUTCDate();
  
  let ms = Date.UTC(year, month, day) - (tzOffset * 60 * 60 * 1000);
  if (isEndOfDay) {
    ms += (24 * 60 * 60 * 1000) - 1;
  }
  return new Date(ms);
}

async function main() {
  // Find doctor Rani Yunita Patong
  const doctor = await prisma.doctor.findFirst({
    where: { doctorCode: 'D214' }
  });
  console.log('Doctor found:', doctor);

  // Find Pediatric room
  const room = await prisma.room.findFirst({
    where: { name: { contains: 'Pediatric' } }
  });
  console.log('Room found:', room);

  if (!doctor || !room) {
    console.error('Doctor or Room not found!');
    return;
  }

  const payload = {
    scheduleDate: '2026-06-11',
    doctorId: doctor.id,
    roomId: room.id,
    floorId: room.floorId || '',
    startTime: '10:00',
    endTime: '13:00',
    reason: '',
    dayName: 'Kamis',
    quota: 999
  };

  console.log('Parsed schedule date:', parseLocalDate(payload.scheduleDate));

  try {
    const createData = { ...payload };
    createData.scheduleDate = parseLocalDate(createData.scheduleDate);

    console.log('Attempting prisma.doctorSchedule.create with:', createData);
    const result = await prisma.doctorSchedule.create({
      data: createData,
      include: { doctor: true, room: true, floor: true }
    });
    console.log('Success! Result:', result);
  } catch (error) {
    console.error('Prisma Error:', error);
  }
}

main().finally(() => prisma.$disconnect());
