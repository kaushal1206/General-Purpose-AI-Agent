import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function ensureDefaultUser() {
  const existing = await prisma.user.findFirst();
  if (!existing) {
    return prisma.user.create({
      data: {
        email: 'default.user@agent.local',
        name: 'Default User'
      }
    });
  }
  return existing;
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
