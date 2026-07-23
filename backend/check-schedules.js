const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const schedules = await prisma.doctorSchedule.findMany({
    include: { doctor: true, room: true }
  });
  console.log(`Total Schedules: ${schedules.length}`);
  schedules.forEach((s, i) => {
    console.log(`[${i+1}] Doctor: ${s.doctor?.doctorName} (${s.doctor?.doctorCode}) | RoomID in Schedule: ${s.roomId} | Room Code: ${s.room?.code} | Room Name: ${s.room?.name}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
