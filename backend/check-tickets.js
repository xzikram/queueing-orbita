const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tickets = await prisma.queueTicket.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(`Total tickets: ${tickets.length}`);
  for (const t of tickets) {
    console.log(`Ticket: ${t.ticketNo} | Status: ${t.status} | Date: ${t.queueDate.toISOString()} | CreatedAt: ${t.createdAt.toISOString()}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
