const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const tickets = await prisma.queueTicket.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Latest Tickets:", JSON.stringify(tickets, null, 2));

  const visits = await prisma.visit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Latest Visits:", JSON.stringify(visits, null, 2));
}

test().catch(console.error).finally(() => prisma.$disconnect());
