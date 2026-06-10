const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  const doctors = await prisma.doctor.findMany({
    select: {
      doctorCode: true,
      doctorName: true,
      doctorInitials: true,
      specialty: true,
      isActive: true
    },
    orderBy: {
      doctorCode: 'asc'
    }
  });
  
  const content = `module.exports = ${JSON.stringify(doctors, null, 2)};`;
  fs.writeFileSync('local-doctors.js', content);
  console.log(`Berhasil mengekspor ${doctors.length} data dokter ke local-doctors.js`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
