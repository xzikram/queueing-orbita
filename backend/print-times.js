const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function print() {
  const schedules = await prisma.doctorSchedule.findMany({ take: 5 });
  console.log(schedules.map(s => ({ start: s.startTime, end: s.endTime })));
}

print().catch(console.error).finally(() => prisma.$disconnect());
