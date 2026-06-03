const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const prefix = 'G'; // UMUM
  
  const ticketNo = `${prefix}001`;

  const [ticket, visit] = await prisma.$transaction(async (p) => {
    const t = await p.queueTicket.create({
      data: {
        ticketNo,
        queueDate: today,
        patientType: 'UMUM',
        status: 'WAITING',
      },
    });

    const v = await p.visit.create({
      data: {
        visitCode: `V-${ticketNo}-${Date.now()}`,
        visitDate: today,
        patientType: 'UMUM',
        queueTicketId: t.id,
        currentUnitType: 'CASHIER',
        currentStatus: 'WAITING',
      },
    });

    await p.journeyUnitSession.create({
      data: {
        visitId: v.id,
        unitType: 'CASHIER',
        status: 'WAITING',
      },
    });

    return [t, v];
  });
  
  console.log("Created Visit:", visit.id);

  // Now test getQueue logic
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

  console.log("Queue Length:", queue.length);
  if (queue.length > 0) {
    console.log("First queue item journey status:", queue[0].journeySessions[0]?.status);
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
