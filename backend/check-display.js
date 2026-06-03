const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const display = await prisma.display.findFirst({ where: { code: 'display_kasir' } });
  console.log("Kasir Display:", display);
}

test().catch(console.error).finally(() => prisma.$disconnect());
