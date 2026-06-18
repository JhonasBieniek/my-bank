jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-4000-8000-000000000099'),
}));

const { transfer, findUserByPayeeIdentifier } = require('../../src/services/transferService');
const {
  isDatabaseAvailable,
  disconnect,
  createTestUser,
  resetWallets,
  getUserBalance,
  verifyAllLedgers,
  cleanupTestUsers,
  OPENING_BALANCE_CENTS,
} = require('../helpers/db');

describe('Transfer edge cases (banco real)', () => {
  let skip = false;
  let ana;
  let bruno;
  const userIds = [];

  beforeAll(async () => {
    const available = await isDatabaseAvailable();
    if (!available) {
      skip = true;
      console.warn(
        'MySQL indisponível — testes de transferência ignorados. Suba o banco (docker compose up db) ou configure DATABASE_URL.'
      );
      return;
    }

    ana = await createTestUser({ name: 'Ana Edge', emailLocal: 'ana-edge' });
    bruno = await createTestUser({ name: 'Bruno Edge', emailLocal: 'bruno-edge' });
    userIds.push(ana.id, bruno.id);
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

  describe('findUserByPayeeIdentifier', () => {
    it('resolve por e-mail com trim e normalização de caixa', async () => {
      if (skip) {
        return;
      }

      const user = await findUserByPayeeIdentifier(` ${bruno.email.toUpperCase()} `);

      expect(user?.id).toBe(bruno.id);
    });

    it('resolve por payment_key', async () => {
      if (skip) {
        return;
      }

      const user = await findUserByPayeeIdentifier(bruno.paymentKey);

      expect(user?.id).toBe(bruno.id);
    });

    it('resolve por telefone normalizado', async () => {
      if (skip) {
        return;
      }

      const localPhone = bruno.phone.replace(/^\+55/, '');
      const user = await findUserByPayeeIdentifier(localPhone);

      expect(user?.id).toBe(bruno.id);
    });
  });

  describe('transfer regras de negócio', () => {
    it('rejeita destinatário inexistente', async () => {
      if (skip) {
        return;
      }

      const result = await transfer({
        sender: ana,
        payeeIdentifier: `inexistente.${Date.now()}@integration.test`,
        amountCents: 100,
        idempotencyKey: `not-found-${Date.now()}`,
      });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('payee_not_found');
    });

    it('rejeita transferência para si mesmo', async () => {
      if (skip) {
        return;
      }

      const result = await transfer({
        sender: ana,
        payeeIdentifier: ana.email,
        amountCents: 100,
        idempotencyKey: `self-${Date.now()}`,
      });

      expect(result.ok).toBe(false);
      expect(result.error.message).toBe('Não é possível transferir para si mesmo');
    });

    it('conclui transferência via payment_key com ledger consistente', async () => {
      if (skip) {
        return;
      }

      const amountCents = 500;
      const result = await transfer({
        sender: ana,
        payeeIdentifier: bruno.paymentKey,
        amountCents,
        idempotencyKey: `by-key-${Date.now()}`,
      });

      expect(result.ok).toBe(true);
      expect(await getUserBalance(ana.id)).toBe(OPENING_BALANCE_CENTS - amountCents);
      expect(await getUserBalance(bruno.id)).toBe(OPENING_BALANCE_CENTS + amountCents);
      await verifyAllLedgers(userIds);
    });
  });
});
