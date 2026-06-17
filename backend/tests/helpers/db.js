const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { PrismaClient } = require('@prisma/client');
const { registerAccount } = require('../../src/services/registerAccountService');
const { OPENING_BALANCE_CENTS } = require('../../src/lib/constants');

const testPrisma = new PrismaClient();

async function isDatabaseAvailable() {
  try {
    await testPrisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function disconnect() {
  await testPrisma.$disconnect();
}

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createTestUser({ name, emailLocal }) {
  const suffix = uniqueSuffix();
  const email = `${emailLocal}.${suffix}@concurrency.test`;
  const phoneDigits = String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

  const result = await registerAccount({
    name,
    email,
    phone: `11${phoneDigits}`,
    password: 'Test@1234',
  });

  if (!result.ok) {
    throw new Error(result.error.message || `Falha ao criar usuário ${name}`);
  }

  return result.value;
}

async function resetUserWallet(userId) {
  await testPrisma.ledgerEntry.deleteMany({
    where: { accountType: 'User', accountId: userId },
  });
  await testPrisma.transfer.deleteMany({
    where: { OR: [{ senderId: userId }, { recipientId: userId }] },
  });
  await testPrisma.user.update({
    where: { id: userId },
    data: { balanceCents: OPENING_BALANCE_CENTS },
  });
  await testPrisma.ledgerEntry.create({
    data: {
      accountType: 'User',
      accountId: userId,
      kind: 'opening_balance',
      amountCents: OPENING_BALANCE_CENTS,
      balanceAfterCents: OPENING_BALANCE_CENTS,
    },
  });
}

async function resetWallets(userIds) {
  for (const userId of userIds) {
    await resetUserWallet(userId);
  }
}

async function getUserBalance(userId) {
  const user = await testPrisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user.balanceCents;
}

async function countTransfers(where = {}) {
  return testPrisma.transfer.count({ where });
}

async function verifyLedgerConsistency(userId) {
  const entries = await testPrisma.ledgerEntry.findMany({
    where: { accountType: 'User', accountId: userId },
    orderBy: { id: 'asc' },
  });
  const user = await testPrisma.user.findUniqueOrThrow({ where: { id: userId } });

  let running = 0;
  for (const entry of entries) {
    running += entry.amountCents;
    if (entry.balanceAfterCents !== running) {
      throw new Error(
        `Ledger inconsistente para usuário ${userId} na entrada ${entry.id}: esperado ${running}, obtido ${entry.balanceAfterCents}`
      );
    }
  }

  if (running !== user.balanceCents) {
    throw new Error(
      `Saldo diverge do ledger para usuário ${userId}: saldo ${user.balanceCents}, ledger ${running}`
    );
  }
}

async function verifyAllLedgers(userIds) {
  for (const userId of userIds) {
    await verifyLedgerConsistency(userId);
  }
}

async function assertBalanceConservation(userIds) {
  const expectedTotal = OPENING_BALANCE_CENTS * userIds.length;
  const users = await testPrisma.user.findMany({ where: { id: { in: userIds } } });
  const actualTotal = users.reduce((sum, user) => sum + user.balanceCents, 0);

  if (actualTotal !== expectedTotal) {
    throw new Error(
      `Conservação de saldo violada: esperado ${expectedTotal}, obtido ${actualTotal}`
    );
  }
}

async function cleanupTestUsers(userIds) {
  if (userIds.length === 0) {
    return;
  }

  await testPrisma.ledgerEntry.deleteMany({
    where: { accountType: 'User', accountId: { in: userIds } },
  });
  await testPrisma.transfer.deleteMany({
    where: {
      OR: [{ senderId: { in: userIds } }, { recipientId: { in: userIds } }],
    },
  });
  await testPrisma.user.deleteMany({ where: { id: { in: userIds } } });
}

module.exports = {
  testPrisma,
  isDatabaseAvailable,
  disconnect,
  createTestUser,
  resetUserWallet,
  resetWallets,
  getUserBalance,
  countTransfers,
  verifyLedgerConsistency,
  verifyAllLedgers,
  assertBalanceConservation,
  cleanupTestUsers,
  OPENING_BALANCE_CENTS,
};
