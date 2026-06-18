let mockUuidCounter = 0;

jest.mock('uuid', () => ({
  v4: jest.fn(() => {
    mockUuidCounter += 1;
    return `10000000-0000-4000-8000-${String(mockUuidCounter).padStart(12, '0')}`;
  }),
}));

const { purchase } = require('../../src/services/purchaseService');
const { createProduct } = require('../../src/services/productService');
const { STORE_TREASURY_SINGLETON_ID } = require('../../src/services/baseService');
const {
  isDatabaseAvailable,
  disconnect,
  createTestUser,
  resetUserWallet,
  getUserBalance,
  testPrisma,
} = require('../helpers/db');

describe('Purchase fee and cashback (banco real)', () => {
  let skip = false;
  let buyer;
  let seller;
  const userIds = [];

  beforeAll(async () => {
    const available = await isDatabaseAvailable();
    if (!available) {
      skip = true;
      console.warn(
        'MySQL indisponível — testes de compra ignorados. Suba o banco (docker compose up db) ou configure DATABASE_URL.'
      );
      return;
    }

    await testPrisma.storeTreasury.upsert({
      where: { id: STORE_TREASURY_SINGLETON_ID },
      update: {},
      create: { id: STORE_TREASURY_SINGLETON_ID, balanceCents: 0 },
    });

    buyer = await createTestUser({ name: 'Buyer Purchase', emailLocal: 'buyer-purchase' });
    seller = await createTestUser({ name: 'Seller Purchase', emailLocal: 'seller-purchase' });
    userIds.push(buyer.id, seller.id);
  });

  afterAll(async () => {
    if (!skip) {
      await testPrisma.ledgerEntry.deleteMany({
        where: {
          OR: [
            { accountType: 'User', accountId: { in: userIds } },
            { accountType: 'StoreTreasury', accountId: STORE_TREASURY_SINGLETON_ID },
          ],
        },
      });
      await testPrisma.purchase.deleteMany({
        where: { buyerId: { in: userIds } },
      });
      await testPrisma.product.deleteMany({
        where: { sellerId: { in: userIds } },
      });
      await testPrisma.storeTreasury.update({
        where: { id: STORE_TREASURY_SINGLETON_ID },
        data: { balanceCents: 0 },
      });
      await testPrisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await disconnect();
  });

  beforeEach(async () => {
    if (skip) {
      return;
    }

    await resetUserWallet(buyer.id);
    await resetUserWallet(seller.id);
    await testPrisma.ledgerEntry.deleteMany({
      where: { accountType: 'StoreTreasury', accountId: STORE_TREASURY_SINGLETON_ID },
    });
    await testPrisma.purchase.deleteMany({
      where: { buyerId: buyer.id },
    });
    await testPrisma.product.deleteMany({ where: { sellerId: seller.id } });
    await testPrisma.storeTreasury.update({
      where: { id: STORE_TREASURY_SINGLETON_ID },
      data: { balanceCents: 0 },
    });
  });

  it('aplica taxa na tesouraria, cashback ao comprador e líquido ao vendedor', async () => {
    if (skip) {
      return;
    }

    const productResult = await createProduct(seller.id, {
      name: 'Produto split',
      price: '19,90',
      cashbackPercent: 5,
      active: true,
    });
    expect(productResult.ok).toBe(true);

    const idempotencyKey = `purchase-split-${Date.now()}`;
    const result = await purchase({
      buyer,
      productId: productResult.value.id,
      idempotencyKey,
    });

    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({
      grossCents: 1_990,
      feeCents: 39,
      cashbackCents: 99,
      sellerNetCents: 1_852,
    });

    expect(await getUserBalance(buyer.id)).toBe(30_000 - 1_990 + 99);
    expect(await getUserBalance(seller.id)).toBe(30_000 + 1_852);

    const treasury = await testPrisma.storeTreasury.findUniqueOrThrow({
      where: { id: STORE_TREASURY_SINGLETON_ID },
    });
    expect(treasury.balanceCents).toBe(39);

    const ledgerKinds = await testPrisma.ledgerEntry.findMany({
      where: { referenceType: 'Purchase', referenceId: result.value.id },
      orderBy: { id: 'asc' },
      select: { kind: true, accountType: true, amountCents: true },
    });

    expect(ledgerKinds).toEqual([
      { kind: 'purchase_debit', accountType: 'User', amountCents: -1_990 },
      { kind: 'purchase_credit', accountType: 'User', amountCents: 1_852 },
      { kind: 'purchase_fee', accountType: 'StoreTreasury', amountCents: 39 },
      { kind: 'purchase_cashback', accountType: 'User', amountCents: 99 },
    ]);
  });
});
