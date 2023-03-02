import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const disconnect = async () => {
  try {
    await prisma.$disconnect();
  } catch (e) {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  }
};
