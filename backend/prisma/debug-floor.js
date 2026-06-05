/**
 * Script debug untuk cek kenapa pasien muncul di TV tapi tidak di Pengkajian.
 * Jalankan di server: node prisma/debug-floor.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log(`Server time now: ${new Date().toISOString()}`);
  console.log(`Today range: ${today.toISOString()} → ${tomorrow.toISOString()}\n`);

  // 1. Floor IDs
  const floors = await prisma.floor.findMany();
  console.log('=== FLOOR IDs ===');
  floors.forEach(f => console.log(`  ${f.name} → ID: ${f.id} (floorNumber: ${f.floorNumber})`));

  // 2. ALL visits today that are NOT finished
  const activeVisits = await prisma.visit.findMany({
    where: {
      visitDate: { gte: today, lt: tomorrow },
      finishedAt: null,
    },
    include: {
      queueTicket: true,
      selectedDoctor: true,
      selectedRoom: { include: { floor: true } },
      selectedFloor: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n=== ALL ACTIVE VISITS TODAY: ${activeVisits.length} ===`);
  for (const v of activeVisits) {
    console.log(`  ${v.queueTicket?.ticketNo || '???'} | unitType=${v.currentUnitType} | status=${v.currentStatus} | floorId=${v.selectedFloorId || 'NULL'} | floor=${v.selectedFloor?.name || 'NULL'} | room=${v.selectedRoom?.name || 'NULL'}`);
  }

  // 3. Visits specifically at ASSESSMENT
  const assessmentVisits = activeVisits.filter(v => v.currentUnitType === 'ASSESSMENT');
  console.log(`\n=== VISITS AT ASSESSMENT: ${assessmentVisits.length} ===`);
  for (const v of assessmentVisits) {
    console.log(`  ${v.queueTicket?.ticketNo || '???'} | status=${v.currentStatus} | floorId=${v.selectedFloorId || 'NULL'} | floor=${v.selectedFloor?.name || 'NULL'}`);
  }

  // 4. What the TV floor display sees (using floorNumber relation)
  for (const floor of floors) {
    const tvWaiting = await prisma.visit.findMany({
      where: {
        visitDate: { gte: today },
        currentStatus: 'WAITING',
        selectedFloor: { floorNumber: floor.floorNumber },
        currentUnitType: { in: ['ASSESSMENT', 'DOCTOR', 'BDR'] },
      },
      include: { queueTicket: true },
    });
    console.log(`\n=== TV ${floor.name} WAITING: ${tvWaiting.length} ===`);
    tvWaiting.forEach(v => console.log(`  ${v.queueTicket?.ticketNo} | unitType=${v.currentUnitType} | floorId=${v.selectedFloorId}`));
  }

  // 5. Test assessment query for each floor
  for (const floor of floors) {
    const assessQ = await prisma.visit.findMany({
      where: {
        currentUnitType: 'ASSESSMENT',
        currentStatus: { in: ['WAITING', 'SERVING'] },
        finishedAt: null,
        visitDate: { gte: today, lt: tomorrow },
        selectedFloorId: floor.id,
      },
      include: { queueTicket: true },
    });
    console.log(`\n=== ASSESSMENT QUERY ${floor.name} (floorId=${floor.id}): ${assessQ.length} ===`);
    assessQ.forEach(v => console.log(`  ${v.queueTicket?.ticketNo} | status=${v.currentStatus}`));
  }

  // 6. Assessment query WITHOUT floor filter
  const assessAll = await prisma.visit.findMany({
    where: {
      currentUnitType: 'ASSESSMENT',
      currentStatus: { in: ['WAITING', 'SERVING'] },
      finishedAt: null,
      visitDate: { gte: today, lt: tomorrow },
    },
    include: { queueTicket: true, selectedFloor: true },
  });
  console.log(`\n=== ASSESSMENT QUERY TANPA FILTER LANTAI: ${assessAll.length} ===`);
  assessAll.forEach(v => console.log(`  ${v.queueTicket?.ticketNo} | floorId=${v.selectedFloorId || 'NULL'} | floor=${v.selectedFloor?.name || 'NULL'}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
