const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// Using global fetch built-in to Node 18+

async function main() {
  const url = 'https://beam.jec.co.id/v1/alb/getParamedicSchedule';
  const token = '88d9e6dd754f742aa7ee7a775bade2c7';

  // Fetch all doctors from database
  const doctors = await prisma.doctor.findMany({
    where: { isActive: true }
  });

  const units = ['A101', 'A102', 'B101', 'C101'];
  
  // Dates to scan: June 1st to June 20th, 2026
  const dates = [];
  for (let d = 1; d <= 20; d++) {
    const dayStr = d.toString().padStart(2, '0');
    dates.push(`202606${dayStr}`);
  }

  console.log(`Scanning schedules for ${doctors.length} doctors, ${dates.length} dates, and ${units.length} unit IDs...`);

  let foundCount = 0;
  
  for (const doc of doctors) {
    // skip doctors with code starting with 'D00' (test doctors)
    if (doc.doctorCode.startsWith('D00')) continue;

    for (const unit of units) {
      for (const date of dates) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'x-connection': 'JEC@RSORBITA',
              'x-token': token,
              'Cache-Control': 'no-cache',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ServiceUnitID: unit,
              ParamedicID: doc.doctorCode, // e.g. D184, D357, etc.
              slot_check: '',
              periodStart: date,
              periodEnd: date
            })
          });
          const data = await res.json();
          if (data.data && data.data.length > 0 && data.data[0].Schedule && data.data[0].Schedule.length > 0) {
            foundCount++;
            console.log(`[${foundCount}] Found Schedule:`);
            console.log(`  Doctor: ${doc.doctorName} (${doc.doctorCode})`);
            console.log(`  Unit: ${unit}`);
            console.log(`  Date: ${date}`);
            console.log(`  Room: ${data.data[0].Schedule[0].RoomID}`);
            console.log(`  Time: ${data.data[0].Schedule[0].StartTime1} - ${data.data[0].Schedule[0].EndTime1}`);
            console.log('---');
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  console.log(`Scan selesai! Total ditemukan ${foundCount} entry jadwal.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
