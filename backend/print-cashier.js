const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const queue = await prisma.visit.findMany({
    where: {
      currentUnitType: 'CASHIER',
      currentStatus: { in: ['WAITING', 'CALLED', 'SERVING', 'WAITING_DESTINATION'] },
      finishedAt: null,
    },
    include: {
      queueTicket: true,
      selectedDoctor: true,
      selectedRoom: { include: { floor: true } },
      journeySessions: {
        where: { unitType: 'CASHIER', status: { notIn: ['FINISHED', 'CANCELLED', 'TRANSFERRED'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { counter: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  console.log(JSON.stringify(queue, null, 2));
}

test().catch(console.error).finally(() => prisma.$disconnect());
