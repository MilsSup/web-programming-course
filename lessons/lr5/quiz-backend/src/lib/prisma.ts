import { PrismaClient } from '@prisma/client';

// Создаем единственный экземпляр PrismaClient для всего приложения
const prisma = new PrismaClient();

export default prisma;