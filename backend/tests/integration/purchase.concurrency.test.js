let mockUuidCounter = 0;

jest.mock('uuid', () => ({
  v4: jest.fn(() => {
    mockUuidCounter += 1;
    return `20000000-0000-4000-8000-${String(mockUuidCounter).padStart(12, '0')}`;
  }),
}));

const { purchase } = require('../../src/services/purchaseService');
const { createProduct } = require('../../src/services/productService');
const { STORE_TREASURY_SINGLETON_ID } = require('../../src/services/baseService');
const {
  isDatabaseAvailable,
  disconnect,
  createTestUser,
  resetWallets,
  getUserBalance,
  verifyAllLedgers,
  cleanupTestUsers,
  testPrisma,
  OPENING_BALANCE_CENTS,
} = require('../helpers/db');

async function resetPurchaseState({ buyerIds, sellerIds }) {
  await resetWallets([...buyerIds, ...sellerIds]);
  await testPrisma.ledgerEntry.deleteMany({
    where: { accountType: 'StoreTreasury', accountId: STORE_TREASURY_SINGLETON_ID },
  });
  await testPrisma.purchase.deleteMany({
    where: { buyerId: { in: buyerIds } },
  });
  await testPrisma.product.deleteMany({
    where: { sellerId: { in: sellerIds } },
  });
  await testPrisma.storeTreasury.update({
    where: { id: STORE_TREASURY_SINGLETON_ID },
    data: { balanceCents: 0 },
  });
}

async function countPurchases(where = {}) {
  return testPrisma.purchase.count({ where });
}

describe('Purchase concurrency (banco real)', () => {
  let skip = false;
  let buyerA;
  let buyerB;
  let seller;
  const buyerIds = [];
  const sellerIds = [];
  const userIds = [];

  beforeAll(async () => {
    const available = await isDatabaseAvailable();
    if (!available) {
      skip = true;
      console.warn(
        'MySQL indisponível — testes de concorrência de compra ignorados. Suba o banco (docker compose up db) ou configure DATABASE_URL.'
      );
      return;
    }

    await testPrisma.storeTreasury.upsert({
      where: { id: STORE_TREASURY_SINGLETON_ID },
      update: {},
      create: { id: STORE_TREASURY_SINGLETON_ID, balanceCents: 0 },
    });

    buyerA = await createTestUser({ name: 'Buyer A Concurrency', emailLocal: 'buyer-a' });
    buyerB = await createTestUser({ name: 'Buyer B Concurrency', emailLocal: 'buyer-b' });
    seller = await createTestUser({ name: 'Seller Concurrency', emailLocal: 'seller' });
    buyerIds.push(buyerA.id, buyerB.id);
    sellerIds.push(seller.id);
    userIds.push(buyerA.id, buyerB.id, seller.id);
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
        where: { buyerId: { in: buyerIds } },
      });
      await testPrisma.product.deleteMany({
        where: { sellerId: { in: sellerIds } },
      });
      await testPrisma.storeTreasury.update({
        where: { id: STORE_TREASURY_SINGLETON_ID },
        data: { balanceCents: 0 },
      });
      await cleanupTestUsers(userIds);
    }
    await disconnect();
  });

  beforeEach(async () => {
    if (skip) {
      return;
    }
    await resetPurchaseState({ buyerIds, sellerIds });
  });

  describe('dois compradores simultâneos no mesmo produto', () => {
    it('conclui ambas as compras sem corromper saldos', async () => {
      if (skip) {
        return;
      }

      const productResult = await createProduct(seller.id, {
        name: 'Produto concorrente',
        price: '10,00',
        cashbackPercent: 0,
        active: true,
      });
      expect(productResult.ok).toBe(true);
      const productId = productResult.value.id;
      const grossCents = 1_000;

      const [resultA, resultB] = await Promise.all([
        purchase({
          buyer: buyerA,
          productId,
          idempotencyKey: `concurrent-buyer-a-${Date.now()}`,
        }),
        purchase({
          buyer: buyerB,
          productId,
          idempotencyKey: `concurrent-buyer-b-${Date.now()}`,
        }),
      ]);

      expect(resultA.ok).toBe(true);
      expect(resultB.ok).toBe(true);
      expect(resultA.value.id).not.toBe(resultB.value.id);

      expect(await getUserBalance(buyerA.id)).toBe(OPENING_BALANCE_CENTS - grossCents);
      expect(await getUserBalance(buyerB.id)).toBe(OPENING_BALANCE_CENTS - grossCents);
      expect(await countPurchases({ productId })).toBe(2);

      await verifyAllLedgers(userIds);
    });
  });

  describe('idempotência sob requisições duplicadas concorrentes', () => {
    it('cria uma única compra e debita o saldo uma vez', async () => {
      if (skip) {
        return;
      }

      const productResult = await createProduct(seller.id, {
        name: 'Produto idempotente',
        price: '7,50',
        cashbackPercent: 0,
        active: true,
      });
      expect(productResult.ok).toBe(true);

      const idempotencyKey = `concurrent-purchase-idempotent-${Date.now()}`;
      const attempts = 8;
      const grossCents = 750;

      const results = await Promise.all(
        Array.from({ length: attempts }, () =>
          purchase({
            buyer: buyerA,
            productId: productResult.value.id,
            idempotencyKey,
          })
        )
      );

      expect(results.every((result) => result.ok)).toBe(true);

      const purchaseIds = new Set(results.map((result) => result.value.id));
      expect(purchaseIds.size).toBe(1);

      expect(await countPurchases({ idempotencyKey })).toBe(1);
      expect(await getUserBalance(buyerA.id)).toBe(OPENING_BALANCE_CENTS - grossCents);

      await verifyAllLedgers(userIds);
    });
  });

  describe('compras paralelas do mesmo comprador acima do saldo', () => {
    it('apenas as acessíveis concluem; demais retornam insufficient_funds sem saldo negativo', async () => {
      if (skip) {
        return;
      }

      const productResult = await createProduct(seller.id, {
        name: 'Produto caro',
        price: '200,00',
        cashbackPercent: 0,
        active: true,
      });
      expect(productResult.ok).toBe(true);

      const grossCents = 20_000;
      const attempts = 5;
      const baseKey = `concurrent-overdraw-${Date.now()}`;

      const results = await Promise.all(
        Array.from({ length: attempts }, (_, index) =>
          purchase({
            buyer: buyerA,
            productId: productResult.value.id,
            idempotencyKey: `${baseKey}-${index}`,
          })
        )
      );

      const successes = results.filter((result) => result.ok);
      const failures = results.filter((result) => !result.ok);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(attempts - 1);
      expect(failures.every((result) => result.error.code === 'insufficient_funds')).toBe(true);

      const buyerBalance = await getUserBalance(buyerA.id);
      expect(buyerBalance).toBeGreaterThanOrEqual(0);
      expect(buyerBalance).toBe(OPENING_BALANCE_CENTS - grossCents);
      expect(await countPurchases({ buyerId: buyerA.id })).toBe(1);

      await verifyAllLedgers(userIds);
    });
  });

  describe('consistência do ledger após compras concorrentes', () => {
    it('mantém ledger alinhado ao saldo com múltiplas compras paralelas', async () => {
      if (skip) {
        return;
      }

      const products = await Promise.all(
        ['5,00', '8,00', '12,00'].map((price, index) =>
          createProduct(seller.id, {
            name: `Produto ledger ${index}`,
            price,
            cashbackPercent: 0,
            active: true,
          })
        )
      );
      expect(products.every((result) => result.ok)).toBe(true);

      const baseKey = `concurrent-ledger-${Date.now()}`;
      const results = await Promise.all(
        products.map((productResult, index) =>
          purchase({
            buyer: buyerA,
            productId: productResult.value.id,
            idempotencyKey: `${baseKey}-${index}`,
          })
        )
      );

      expect(results.every((result) => result.ok)).toBe(true);
      expect(await countPurchases({ buyerId: buyerA.id })).toBe(3);

      const expectedDebit = 500 + 800 + 1_200;
      expect(await getUserBalance(buyerA.id)).toBe(OPENING_BALANCE_CENTS - expectedDebit);

      await verifyAllLedgers(userIds);
    });
  });
});
