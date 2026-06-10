const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const floors = await prisma.floor.findMany();
  console.log('=== ALL FLOORS IN DB ===');
  floors.forEach(f => {
    console.log(`ID: ${f.id} | Name: ${f.name} | Number: ${f.floorNumber}`);
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
