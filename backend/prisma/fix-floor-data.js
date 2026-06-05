/**
 * Script untuk memperbaiki data visit yang selectedFloorId-nya null
 * padahal sudah punya selectedRoom yang terhubung ke floor.
 * 
 * Jalankan di server: node prisma/fix-floor-data.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Memperbaiki data visit yang selectedFloorId-nya kosong...\n');

  // Find visits where selectedFloorId is null but selectedRoomId exists
  const visitsWithoutFloor = await prisma.visit.findMany({
    where: {
      selectedFloorId: null,
      selectedRoomId: { not: null },
    },
    include: {
      selectedRoom: { include: { floor: true } },
      queueTicket: true,
    },
  });

  console.log(`Ditemukan ${visitsWithoutFloor.length} visit tanpa selectedFloorId\n`);

  let fixed = 0;
  for (const v of visitsWithoutFloor) {
    if (v.selectedRoom?.floorId) {
      await prisma.visit.update({
        where: { id: v.id },
        data: { selectedFloorId: v.selectedRoom.floorId },
      });
      console.log(`✅ Fixed visit ${v.queueTicket?.ticketNo || v.id} → floor: ${v.selectedRoom.floor?.name}`);
      fixed++;
    }
  }

  // Also fix visits where selectedFloorId is null but selectedScheduleId exists
  const visitsWithSchedule = await prisma.visit.findMany({
    where: {
      selectedFloorId: null,
      selectedScheduleId: { not: null },
    },
    include: {
      selectedSchedule: { include: { room: { include: { floor: true } } } },
      queueTicket: true,
    },
  });

  console.log(`\nDitemukan ${visitsWithSchedule.length} visit lain dengan schedule tapi tanpa floor\n`);

  for (const v of visitsWithSchedule) {
    if (v.selectedSchedule) {
      const updates = {};
      if (!v.selectedRoomId && v.selectedSchedule.roomId) updates.selectedRoomId = v.selectedSchedule.roomId;
      if (v.selectedSchedule.floorId) updates.selectedFloorId = v.selectedSchedule.floorId;
      if (!v.selectedDoctorId && v.selectedSchedule.doctorId) updates.selectedDoctorId = v.selectedSchedule.doctorId;

      if (Object.keys(updates).length > 0) {
        await prisma.visit.update({ where: { id: v.id }, data: updates });
        console.log(`✅ Fixed visit ${v.queueTicket?.ticketNo || v.id} from schedule → floor: ${v.selectedSchedule.room?.floor?.name}`);
        fixed++;
      }
    }
  }

  // Also fix journey sessions that have null floorId but their visit has a floor
  const sessionsWithoutFloor = await prisma.journeyUnitSession.findMany({
    where: {
      floorId: null,
      visit: { selectedFloorId: { not: null } },
    },
    include: {
      visit: { include: { selectedFloor: true, queueTicket: true } },
    },
  });

  console.log(`\nDitemukan ${sessionsWithoutFloor.length} journey session tanpa floorId\n`);

  let sessionFixed = 0;
  for (const s of sessionsWithoutFloor) {
    if (s.visit.selectedFloorId) {
      await prisma.journeyUnitSession.update({
        where: { id: s.id },
        data: { 
          floorId: s.visit.selectedFloorId,
          roomId: s.roomId || s.visit.selectedRoomId,
        },
      });
      sessionFixed++;
    }
  }
  console.log(`✅ Fixed ${sessionFixed} journey sessions\n`);

  console.log(`\n🎉 Selesai! Total ${fixed} visit dan ${sessionFixed} session diperbaiki.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
