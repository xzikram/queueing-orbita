const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const schedules = await prisma.doctorSchedule.findMany();
  let updated = 0;
  for (const s of schedules) {
    const fixTime = (timeStr) => {
      if (!timeStr || !timeStr.includes('.57')) return timeStr;
      const parts = timeStr.replace(/\./g, ':').split(':');
      let h = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      let sec = parseInt(parts[2] || '0', 10);
      
      let date = new Date(2020, 0, 2, h, m, sec, 0); // use a fixed date (Jan 2) to avoid day wrapping issues
      date.setTime(date.getTime() - (7 * 3600 + 57 * 60 + 36) * 1000);
      
      let newH = String(date.getHours()).padStart(2, '0');
      let newM = String(date.getMinutes()).padStart(2, '0');
      return `${newH}:${newM}`;
    };

    const fs = fixTime(s.startTime);
    const fe = fixTime(s.endTime);

    if (fs !== s.startTime || fe !== s.endTime) {
      await prisma.doctorSchedule.update({
        where: { id: s.id },
        data: { startTime: fs, endTime: fe }
      });
      updated++;
    }
  }
  console.log(`Updated ${updated} schedules.`);
}

fix().catch(console.error).finally(() => prisma.$disconnect());
