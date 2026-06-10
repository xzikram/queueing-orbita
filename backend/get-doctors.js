const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const doctors = await prisma.doctor.findMany({
    include: { defaultRoom: true },
    take: 5
  });
  console.log("Doctors:", JSON.stringify(doctors, null, 2));

  const rooms = await prisma.room.findMany({
    take: 5
  });
  console.log("Rooms:", JSON.stringify(rooms, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
