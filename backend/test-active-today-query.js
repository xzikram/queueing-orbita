const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findActiveToday() {
  let tzOffset = 8; // Default to Asia/Makassar (WITA, UTC+8)
  if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
  else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;

  const now = new Date();
  const localTime = now.getTime() + tzOffset * 60 * 60 * 1000;
  const localDate = new Date(localTime);

  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth();
  const day = localDate.getUTCDate();

  const today = new Date(
    Date.UTC(year, month, day) - tzOffset * 60 * 60 * 1000,
  );
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  console.log(`Local Time: ${localDate.toISOString()}`);
  console.log(`Today Boundary: ${today.toISOString()}`);
  console.log(`Tomorrow Boundary: ${tomorrow.toISOString()}`);

  const schedules = await prisma.doctorSchedule.findMany({
    where: {
      scheduleDate: { gte: today, lt: tomorrow },
      status: 'ACTIVE',
    },
    include: {
      doctor: true,
      room: { include: { floor: true } },
      floor: true,
    },
    orderBy: { startTime: 'asc' },
  });
  return schedules;
}

async function main() {
  const result = await findActiveToday();
  console.log(`Active schedules today count: ${result.length}`);
  for (const s of result) {
    console.log(`- Doctor: ${s.doctor.doctorName} (${s.doctor.doctorCode}) | Room: ${s.room?.name}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
