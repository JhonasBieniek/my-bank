let mockUuidCounter = 0;

jest.mock('uuid', () => ({
  v4: jest.fn(() => {
    mockUuidCounter += 1;
    return `30000000-0000-4000-8000-${String(mockUuidCounter).padStart(12, '0')}`;
  }),
}));

const { registerAccount } = require('../../src/services/registerAccountService');
const {
  isDatabaseAvailable,
  disconnect,
  testPrisma,
  verifyLedgerConsistency,
  OPENING_BALANCE_CENTS,
} = require('../helpers/db');

describe('Register account (banco real)', () => {
  let skip = false;
  const createdUserIds = [];

  beforeAll(async () => {
    skip = !(await isDatabaseAvailable());
    if (skip) {
      console.warn(
        'MySQL indisponível — testes de cadastro ignorados. Suba o banco (docker compose up db) ou configure DATABASE_URL.'
      );
    }
  });

  afterAll(async () => {
    if (!skip && createdUserIds.length > 0) {
      await testPrisma.ledgerEntry.deleteMany({
        where: { accountType: 'User', accountId: { in: createdUserIds } },
      });
      await testPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await disconnect();
  });

  it('cria usuário com saldo inicial e lançamento opening_balance no ledger', async () => {
    if (skip) {
      return;
    }

    const suffix = Date.now();
    const result = await registerAccount({
      name: '  Test  User  ',
      email: `Register.${suffix}@Integration.Test`,
      phone: `1199${String(suffix).slice(-8)}`,
      password: 'senha1234',
    });

    expect(result.ok).toBe(true);
    createdUserIds.push(result.value.id);
    expect(result.value.balanceCents).toBe(OPENING_BALANCE_CENTS);
    expect(result.value.email).toBe(`register.${suffix}@integration.test`);
    expect(result.value.name).toBe('Test User');

    const openingEntry = await testPrisma.ledgerEntry.findFirst({
      where: { accountId: result.value.id, kind: 'opening_balance' },
    });

    expect(openingEntry).not.toBeNull();
    expect(openingEntry.amountCents).toBe(OPENING_BALANCE_CENTS);
    expect(openingEntry.balanceAfterCents).toBe(OPENING_BALANCE_CENTS);
    await verifyLedgerConsistency(result.value.id);
  });

  it('retorna telefone inválido sem persistir usuário', async () => {
    const result = await registerAccount({
      name: 'Test',
      email: `invalid-phone-${Date.now()}@integration.test`,
      phone: 'abc',
      password: 'senha1234',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toEqual({ status: 422, message: 'Telefone inválido' });
  });

  it('retorna telefone já cadastrado em conflito de unicidade', async () => {
    if (skip) {
      return;
    }

    const suffix = Date.now();
    const phone = `1198${String(suffix).slice(-8)}`;
    const first = await registerAccount({
      name: 'Primeiro',
      email: `first.${suffix}@integration.test`,
      phone,
      password: 'senha1234',
    });

    expect(first.ok).toBe(true);
    createdUserIds.push(first.value.id);

    const second = await registerAccount({
      name: 'Segundo',
      email: `second.${suffix}@integration.test`,
      phone,
      password: 'senha1234',
    });

    expect(second.ok).toBe(false);
    expect(second.error).toEqual({ status: 422, message: 'Telefone já cadastrado' });
  });
});
