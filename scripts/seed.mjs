import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@local';
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin';
  const name = process.env.SEED_ADMIN_NAME || 'Admin';

  const hash = bcrypt.hashSync(password, 8);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash: hash, role: 'admin' },
    create: { email, name, passwordHash: hash, role: 'admin' },
  });

  console.log('Seed ok for user:', user.email);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
