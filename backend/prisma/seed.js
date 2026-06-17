require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { PrismaClient } = require('@prisma/client');
const { registerAccount } = require('../src/services/registerAccountService');
const { transfer } = require('../src/services/transferService');

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@2026!';

const USERS = [
  {
    name: 'Ana Demo',
    email: 'ana@demo.mybank.local',
    phone: '+5511999990001',
    payment_key: '11111111-1111-1111-1111-111111111111',
  },
  {
    name: 'Bruno Demo',
    email: 'bruno@demo.mybank.local',
    phone: '+5511999990002',
    payment_key: '22222222-2222-2222-2222-222222222222',
  },
];

const SAMPLE_TRANSFER_IDEMPOTENCY_KEY = 'seed-sample-transfer-ana-bruno';
const SAMPLE_TRANSFER_AMOUNT_CENTS = 500;

async function createUsers() {
  const users = [];

  for (const userAttrs of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: userAttrs.email } });
    if (existing) {
      users.push(existing);
      continue;
    }

    const result = await registerAccount({
      name: userAttrs.name,
      email: userAttrs.email,
      phone: userAttrs.phone,
      password: DEMO_PASSWORD,
    });

    if (!result.ok) {
      throw new Error(result.error.message || 'Falha ao criar usuário demo');
    }

    const user = await prisma.user.update({
      where: { id: result.value.id },
      data: { paymentKey: userAttrs.payment_key },
    });

    users.push(user);
  }

  return users;
}

async function sampleTransfer(users) {
  const ana = users.find((user) => user.email === 'ana@demo.mybank.local');
  const bruno = users.find((user) => user.email === 'bruno@demo.mybank.local');

  if (!ana || !bruno) {
    return;
  }

  const existing = await prisma.transfer.findUnique({
    where: { idempotencyKey: SAMPLE_TRANSFER_IDEMPOTENCY_KEY },
  });

  if (existing) {
    return;
  }

  const result = await transfer({
    sender: ana,
    payeeIdentifier: bruno.paymentKey,
    amountCents: SAMPLE_TRANSFER_AMOUNT_CENTS,
    idempotencyKey: SAMPLE_TRANSFER_IDEMPOTENCY_KEY,
  });

  if (!result.ok) {
    throw new Error(result.error.message || 'Falha na transferência demo');
  }
}

async function main() {
  const users = await createUsers();
  await sampleTransfer(users);

  console.log(`Demo seed: ${users.length} usuários, 1 transferência.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
