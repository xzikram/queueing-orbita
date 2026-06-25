const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const schedules = await prisma.doctorSchedule.findMany({
    include: { doctor: true, room: true }
  });

  console.log(`Total schedules in DB: ${schedules.length}`);

  const activeSchedules = schedules.filter(s => !s.doctor.doctorCode.startsWith('D00'));
  console.log(`Real doctor schedules (not dummy D001-D010): ${activeSchedules.length}`);
  
  for (const s of activeSchedules) {
    console.log(`- Doctor: ${s.doctor.doctorName} (${s.doctor.doctorCode}) | Room: ${s.room?.code} (${s.room?.name}) | Date: ${s.scheduleDate.toISOString().split('T')[0]} | Time: ${s.startTime}-${s.endTime}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
