const { prisma } = require('../lib/prisma');

const STORE_TREASURY_SINGLETON_ID = 1;

class InsufficientFundsError extends Error {
  constructor(message = 'Saldo insuficiente') {
    super(message);
    this.name = 'InsufficientFundsError';
  }
}

class InvalidOperationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidOperationError';
  }
}

async function withWalletTransaction(callback) {
  return prisma.$transaction(callback);
}

async function lockUser(tx, userId) {
  const rows = await tx.$queryRaw`
    SELECT
      id,
      name,
      email,
      phone,
      password_digest AS passwordDigest,
      payment_key AS paymentKey,
      balance_cents AS balanceCents,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM users
    WHERE id = ${userId}
    FOR UPDATE
  `;

  const row = rows[0];
  if (!row) {
    return tx.user.findUniqueOrThrow({ where: { id: userId } });
  }

  return {
    ...row,
    balanceCents: Number(row.balanceCents),
  };
}

async function lockTreasury(tx) {
  const rows = await tx.$queryRaw`
    SELECT
      id,
      balance_cents AS balanceCents,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM store_treasuries
    WHERE id = ${STORE_TREASURY_SINGLETON_ID}
    FOR UPDATE
  `;

  const row = rows[0];
  if (!row) {
    return tx.storeTreasury.findUniqueOrThrow({ where: { id: STORE_TREASURY_SINGLETON_ID } });
  }

  return {
    ...row,
    balanceCents: Number(row.balanceCents),
  };
}

async function applyTreasuryBalance(tx, treasuryId, currentBalanceCents, deltaCents) {
  const newBalance = currentBalanceCents + deltaCents;
  if (newBalance < 0) {
    throw new InsufficientFundsError();
  }
  await tx.storeTreasury.update({
    where: { id: treasuryId },
    data: { balanceCents: newBalance },
  });
  return newBalance;
}

async function applyUserBalance(tx, userId, currentBalanceCents, deltaCents) {
  const newBalance = currentBalanceCents + deltaCents;
  if (newBalance < 0) {
    throw new InsufficientFundsError();
  }
  await tx.user.update({ where: { id: userId }, data: { balanceCents: newBalance } });
  return newBalance;
}

async function recordLedgerEntry(
  tx,
  {
    accountType,
    accountId,
    kind,
    amountCents,
    balanceAfterCents,
    referenceType = null,
    referenceId = null,
    idempotencyKey = null,
    metadata = null,
  }
) {
  return tx.ledgerEntry.create({
    data: {
      accountType,
      accountId,
      kind,
      amountCents,
      balanceAfterCents,
      referenceType,
      referenceId,
      idempotencyKey,
      metadata: metadata == null ? null : typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
    },
  });
}

module.exports = {
  InsufficientFundsError,
  InvalidOperationError,
  STORE_TREASURY_SINGLETON_ID,
  withWalletTransaction,
  lockUser,
  lockTreasury,
  applyUserBalance,
  applyTreasuryBalance,
  recordLedgerEntry,
};
