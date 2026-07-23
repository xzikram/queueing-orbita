const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({ include: { floor: true } });
  console.log(`Total Rooms: ${rooms.length}`);
  rooms.forEach((r, i) => {
    console.log(`[${i+1}] ID: ${r.id} | Code: "${r.code}" | Name: "${r.name}" | Floor: "${r.floor?.name}"`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
