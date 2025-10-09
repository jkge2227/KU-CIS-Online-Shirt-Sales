// Server/scripts/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // seed Size
  await prisma.size.createMany({
    data: [
      { name: 'S' },
      { name: 'M' },    
      { name: 'L' },
    ],
    skipDuplicates: true,
  });

  // seed Generation
  await prisma.generation.createMany({
    data: [{ name: 'DEFAULT' }],
    skipDuplicates: true,
  });

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
