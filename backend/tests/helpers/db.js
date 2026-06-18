const path = require('path');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { PrismaClient } = require('@prisma/client');
const { normalize: normalizePhone } = require('../../src/lib/phoneNormalizer');
const {
  withWalletTransaction,
  applyUserBalance,
  recordLedgerEntry,
} = require('../../src/services/baseService');
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
  const email = `${emailLocal}.${suffix}@concurrency.test`.toLowerCase();
  const phone = normalizePhone(randomUUID().replace(/\D/g, '').slice(0, 11));
  const passwordDigest = await bcrypt.hash('Test@1234', 12);

  return withWalletTransaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: name.trim(),
        email,
        phone,
        passwordDigest,
        paymentKey: randomUUID(),
        balanceCents: 0,
      },
    });

    const balanceAfterCents = await applyUserBalance(
      tx,
      createdUser.id,
      0,
      OPENING_BALANCE_CENTS
    );

    await recordLedgerEntry(tx, {
      accountType: 'User',
      accountId: createdUser.id,
      kind: 'opening_balance',
      amountCents: OPENING_BALANCE_CENTS,
      balanceAfterCents,
      referenceType: 'User',
      referenceId: createdUser.id,
      metadata: { reason: 'opening_balance' },
    });

    return tx.user.findUniqueOrThrow({ where: { id: createdUser.id } });
  });
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
