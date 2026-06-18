const { prisma } = require('../lib/prisma');
const { ok, fail } = require('./result');
const { calculatePurchaseSplit } = require('./purchaseSplit');
const {
  InsufficientFundsError,
  InvalidOperationError,
  withWalletTransaction,
  lockUser,
  lockTreasury,
  applyUserBalance,
  applyTreasuryBalance,
  recordLedgerEntry,
} = require('./baseService');

async function purchase({ buyer, productId, idempotencyKey }) {
  const existing = await prisma.purchase.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return ok(existing);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { seller: true },
  });

  if (!product || !product.active) {
    return fail({ message: 'Produto não encontrado', code: 'product_not_found' });
  }

  if (product.sellerId === buyer.id) {
    return fail({ message: 'Não é possível comprar seu próprio produto' });
  }

  let split;
  try {
    split = calculatePurchaseSplit({
      priceCents: product.priceCents,
      cashbackPercent: product.cashbackPercent,
    });
  } catch (error) {
    if (error instanceof InvalidOperationError) {
      return fail({ message: error.message });
    }
    throw error;
  }

  try {
    const purchaseRecord = await withWalletTransaction(async (tx) => {
      const [firstUserId, secondUserId] = [buyer.id, product.sellerId].sort((a, b) => a - b);
      const lockedFirst = await lockUser(tx, firstUserId);
      const lockedSecond = await lockUser(tx, secondUserId);
      const lockedTreasury = await lockTreasury(tx);

      const lockedBuyer = lockedFirst.id === buyer.id ? lockedFirst : lockedSecond;
      const lockedSeller = lockedFirst.id === product.sellerId ? lockedFirst : lockedSecond;

      if (lockedBuyer.balanceCents < split.grossCents) {
        throw new InsufficientFundsError();
      }

      const buyerBalance = await applyUserBalance(
        tx,
        lockedBuyer.id,
        lockedBuyer.balanceCents,
        -split.grossCents
      );
      const sellerBalance = await applyUserBalance(
        tx,
        lockedSeller.id,
        lockedSeller.balanceCents,
        split.sellerNetCents
      );
      const treasuryBalance = await applyTreasuryBalance(
        tx,
        lockedTreasury.id,
        lockedTreasury.balanceCents,
        split.feeCents
      );

      const createdPurchase = await tx.purchase.create({
        data: {
          buyerId: lockedBuyer.id,
          productId: product.id,
          grossCents: split.grossCents,
          feeCents: split.feeCents,
          cashbackCents: split.cashbackCents,
          sellerNetCents: split.sellerNetCents,
          idempotencyKey,
        },
      });

      const purchaseMetadata = { product_id: product.id, product_name: product.name };

      await recordLedgerEntry(tx, {
        accountType: 'User',
        accountId: lockedBuyer.id,
        kind: 'purchase_debit',
        amountCents: -split.grossCents,
        balanceAfterCents: buyerBalance,
        referenceType: 'Purchase',
        referenceId: createdPurchase.id,
        idempotencyKey,
        metadata: purchaseMetadata,
      });

      await recordLedgerEntry(tx, {
        accountType: 'User',
        accountId: lockedSeller.id,
        kind: 'purchase_credit',
        amountCents: split.sellerNetCents,
        balanceAfterCents: sellerBalance,
        referenceType: 'Purchase',
        referenceId: createdPurchase.id,
        idempotencyKey,
        metadata: purchaseMetadata,
      });

      await recordLedgerEntry(tx, {
        accountType: 'StoreTreasury',
        accountId: lockedTreasury.id,
        kind: 'purchase_fee',
        amountCents: split.feeCents,
        balanceAfterCents: treasuryBalance,
        referenceType: 'Purchase',
        referenceId: createdPurchase.id,
        idempotencyKey,
        metadata: purchaseMetadata,
      });

      if (split.cashbackCents > 0) {
        const buyerCashbackBalance = await applyUserBalance(
          tx,
          lockedBuyer.id,
          buyerBalance,
          split.cashbackCents
        );

        await recordLedgerEntry(tx, {
          accountType: 'User',
          accountId: lockedBuyer.id,
          kind: 'purchase_cashback',
          amountCents: split.cashbackCents,
          balanceAfterCents: buyerCashbackBalance,
          referenceType: 'Purchase',
          referenceId: createdPurchase.id,
          idempotencyKey,
          metadata: purchaseMetadata,
        });
      }

      return createdPurchase;
    });

    return ok(purchaseRecord);
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return fail({ message: 'Saldo insuficiente', code: 'insufficient_funds' });
    }

    if (error.code === 'P2002') {
      const duplicate = await prisma.purchase.findUnique({ where: { idempotencyKey } });
      return ok(duplicate);
    }

    throw error;
  }
}

module.exports = { purchase };
