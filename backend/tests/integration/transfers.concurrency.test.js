let mockUuidCounter = 0;

jest.mock('uuid', () => ({
  v4: jest.fn(() => {
    mockUuidCounter += 1;
    return `00000000-0000-4000-8000-${String(mockUuidCounter).padStart(12, '0')}`;
  }),
}));

const { transfer } = require('../../src/services/transferService');
const {
  isDatabaseAvailable,
  disconnect,
  createTestUser,
  resetWallets,
  getUserBalance,
  countTransfers,
  verifyAllLedgers,
  assertBalanceConservation,
  cleanupTestUsers,
  OPENING_BALANCE_CENTS,
} = require('../helpers/db');

describe('Transfer concurrency (banco real)', () => {
  let skip = false;
  let ana;
  let bruno;
  let carla;
  const userIds = [];

  beforeAll(async () => {
    const available = await isDatabaseAvailable();
    if (!available) {
      skip = true;
      console.warn(
        'MySQL indisponível — testes de concorrência ignorados. Suba o banco (docker compose up db) ou configure DATABASE_URL.'
      );
      return;
    }

    ana = await createTestUser({ name: 'Ana Concurrency', emailLocal: 'ana' });
    bruno = await createTestUser({ name: 'Bruno Concurrency', emailLocal: 'bruno' });
    carla = await createTestUser({ name: 'Carla Concurrency', emailLocal: 'carla' });
    userIds.push(ana.id, bruno.id, carla.id);
  });

  afterAll(async () => {
    if (!skip) {
      await cleanupTestUsers(userIds);
    }
    await disconnect();
  });

  beforeEach(async () => {
    if (skip) {
      return;
    }
    await resetWallets(userIds);
  });

  describe('dois remetentes simultâneos para o mesmo destinatário', () => {
    it('credita Bruno corretamente sem corromper saldos', async () => {
      if (skip) {
        return;
      }

      const amountAna = 1_000;
      const amountCarla = 2_000;
      const idempotencyAna = `concurrent-ana-bruno-${Date.now()}`;
      const idempotencyCarla = `concurrent-carla-bruno-${Date.now()}`;

      const [resultAna, resultCarla] = await Promise.all([
        transfer({
          sender: ana,
          payeeIdentifier: bruno.email,
          amountCents: amountAna,
          idempotencyKey: idempotencyAna,
        }),
        transfer({
          sender: carla,
          payeeIdentifier: bruno.email,
          amountCents: amountCarla,
          idempotencyKey: idempotencyCarla,
        }),
      ]);

      expect(resultAna.ok).toBe(true);
      expect(resultCarla.ok).toBe(true);

      expect(await getUserBalance(ana.id)).toBe(OPENING_BALANCE_CENTS - amountAna);
      expect(await getUserBalance(carla.id)).toBe(OPENING_BALANCE_CENTS - amountCarla);
      expect(await getUserBalance(bruno.id)).toBe(OPENING_BALANCE_CENTS + amountAna + amountCarla);

      expect(await countTransfers({ recipientId: bruno.id })).toBe(2);
      await verifyAllLedgers(userIds);
      await assertBalanceConservation(userIds);
    });
  });

  describe('remetente e destinatário sobrepostos (Ana→Bruno ∥ Bruno→Carla)', () => {
    it('serializa transações envolvendo Bruno sem saldo negativo', async () => {
      if (skip) {
        return;
      }

      const anaToBruno = 500;
      const brunoToCarla = 300;

      const [anaResult, brunoResult] = await Promise.all([
        transfer({
          sender: ana,
          payeeIdentifier: bruno.email,
          amountCents: anaToBruno,
          idempotencyKey: `overlap-ana-bruno-${Date.now()}`,
        }),
        transfer({
          sender: bruno,
          payeeIdentifier: carla.email,
          amountCents: brunoToCarla,
          idempotencyKey: `overlap-bruno-carla-${Date.now()}`,
        }),
      ]);

      expect(anaResult.ok).toBe(true);
      expect(brunoResult.ok).toBe(true);

      expect(await getUserBalance(ana.id)).toBe(OPENING_BALANCE_CENTS - anaToBruno);
      expect(await getUserBalance(bruno.id)).toBe(
        OPENING_BALANCE_CENTS + anaToBruno - brunoToCarla
      );
      expect(await getUserBalance(carla.id)).toBe(OPENING_BALANCE_CENTS + brunoToCarla);

      expect(
        await countTransfers({
          OR: [{ senderId: { in: userIds } }, { recipientId: { in: userIds } }],
        })
      ).toBe(2);
      await verifyAllLedgers(userIds);
      await assertBalanceConservation(userIds);
    });
  });

  describe('transferências paralelas do saldo integral (simula 2+ abas)', () => {
    it('apenas uma conclui; demais falham com saldo insuficiente', async () => {
      if (skip) {
        return;
      }

      const fullBalance = OPENING_BALANCE_CENTS;
      const attempts = 3;
      const baseKey = `concurrent-full-balance-${Date.now()}`;
      const recipients = [bruno.email, carla.email, bruno.email];

      const results = await Promise.all(
        Array.from({ length: attempts }, (_, index) =>
          transfer({
            sender: ana,
            payeeIdentifier: recipients[index],
            amountCents: fullBalance,
            idempotencyKey: `${baseKey}-${index}`,
          })
        )
      );

      const successes = results.filter((result) => result.ok);
      const failures = results.filter((result) => !result.ok);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(attempts - 1);
      expect(failures.every((result) => result.error.code === 'insufficient_funds')).toBe(true);

      expect(await getUserBalance(ana.id)).toBe(0);
      expect(await countTransfers({ senderId: ana.id })).toBe(1);

      const brunoBalance = await getUserBalance(bruno.id);
      const carlaBalance = await getUserBalance(carla.id);
      const creditedTotal = brunoBalance + carlaBalance - 2 * OPENING_BALANCE_CENTS;
      expect(creditedTotal).toBe(fullBalance);

      await verifyAllLedgers(userIds);
      await assertBalanceConservation(userIds);
    });
  });

  describe('idempotência sob requisições duplicadas concorrentes', () => {
    it('cria uma única transferência e debita o saldo uma vez', async () => {
      if (skip) {
        return;
      }

      const amountCents = 750;
      const idempotencyKey = `concurrent-idempotent-${Date.now()}`;
      const attempts = 8;

      const results = await Promise.all(
        Array.from({ length: attempts }, () =>
          transfer({
            sender: ana,
            payeeIdentifier: bruno.email,
            amountCents,
            idempotencyKey,
          })
        )
      );

      expect(results.every((result) => result.ok)).toBe(true);

      const transferIds = new Set(results.map((result) => result.value.id));
      expect(transferIds.size).toBe(1);

      expect(await countTransfers({ idempotencyKey })).toBe(1);
      expect(await getUserBalance(ana.id)).toBe(OPENING_BALANCE_CENTS - amountCents);
      expect(await getUserBalance(bruno.id)).toBe(OPENING_BALANCE_CENTS + amountCents);

      await verifyAllLedgers(userIds);
      await assertBalanceConservation(userIds);
    });
  });
});
