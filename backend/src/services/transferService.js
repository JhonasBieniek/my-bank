const { prisma } = require('../lib/prisma');
const { normalize: normalizePhone } = require('../lib/phoneNormalizer');
const { normalizeEmail } = require('./registerAccountService');
const { ok, fail } = require('./result');
const {
  InsufficientFundsError,
  withWalletTransaction,
  lockUser,
  applyUserBalance,
  recordLedgerEntry,
} = require('./baseService');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findUserByPayeeIdentifier(payeeIdentifier) {
  const identifier = payeeIdentifier?.trim();
  if (!identifier) {
    return null;
  }

  if (identifier.includes('@')) {
    return prisma.user.findUnique({ where: { email: normalizeEmail(identifier) } });
  }

  if (UUID_PATTERN.test(identifier)) {
    return prisma.user.findUnique({ where: { paymentKey: identifier } });
  }

  const normalizedPhone = normalizePhone(identifier);
  if (normalizedPhone && /\d/.test(identifier)) {
    return prisma.user.findUnique({ where: { phone: normalizedPhone } });
  }

  return null;
}

async function transfer({ sender, payeeIdentifier, amountCents, idempotencyKey }) {
  const existing = await prisma.transfer.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return ok(existing);
  }

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return fail({ message: 'Valor inválido' });
  }

  const recipient = await findUserByPayeeIdentifier(payeeIdentifier);
  if (!recipient) {
    return fail({ message: 'Destinatário não encontrado', code: 'payee_not_found' });
  }

  if (recipient.id === sender.id) {
    return fail({ message: 'Não é possível transferir para si mesmo' });
  }

  try {
    const transferRecord = await withWalletTransaction(async (tx) => {
      const [firstUserId, secondUserId] = [sender.id, recipient.id].sort((a, b) => a - b);
      const lockedFirst = await lockUser(tx, firstUserId);
      const lockedSecond = await lockUser(tx, secondUserId);

      const lockedSender = lockedFirst.id === sender.id ? lockedFirst : lockedSecond;
      const lockedRecipient = lockedFirst.id === recipient.id ? lockedFirst : lockedSecond;

      if (lockedSender.balanceCents < amountCents) {
        throw new InsufficientFundsError();
      }

      const senderBalance = await applyUserBalance(
        tx,
        lockedSender.id,
        lockedSender.balanceCents,
        -amountCents
      );
      const recipientBalance = await applyUserBalance(
        tx,
        lockedRecipient.id,
        lockedRecipient.balanceCents,
        amountCents
      );

      const createdTransfer = await tx.transfer.create({
        data: {
          senderId: lockedSender.id,
          recipientId: lockedRecipient.id,
          amountCents,
          idempotencyKey,
        },
      });

      await recordLedgerEntry(tx, {
        accountType: 'User',
        accountId: lockedSender.id,
        kind: 'transfer_debit',
        amountCents: -amountCents,
        balanceAfterCents: senderBalance,
        referenceType: 'Transfer',
        referenceId: createdTransfer.id,
        idempotencyKey,
      });

      await recordLedgerEntry(tx, {
        accountType: 'User',
        accountId: lockedRecipient.id,
        kind: 'transfer_credit',
        amountCents,
        balanceAfterCents: recipientBalance,
        referenceType: 'Transfer',
        referenceId: createdTransfer.id,
        idempotencyKey,
      });

      return createdTransfer;
    });

    return ok(transferRecord);
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return fail({ message: 'Saldo insuficiente', code: 'insufficient_funds' });
    }

    if (error.code === 'P2002') {
      const duplicate = await prisma.transfer.findUnique({ where: { idempotencyKey } });
      return ok(duplicate);
    }

    throw error;
  }
}

module.exports = { findUserByPayeeIdentifier, transfer };
