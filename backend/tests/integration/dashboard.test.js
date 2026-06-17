jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}));

jest.mock('../../src/middleware/rateLimit', () => ({
  loginLimiter: (_req, _res, next) => next(),
  registerLimiter: (_req, _res, next) => next(),
}));

jest.mock('../../src/lib/prisma', () => ({
  prisma: require('../helpers/prismaMock').mockPrisma,
}));

const request = require('supertest');
const { mockPrisma, resetPrismaMock } = require('../helpers/prismaMock');
const { createAuthenticatedAgent } = require('../helpers/session');
const { app } = require('../helpers/app');

describe('GET /dashboard', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('retorna 401 sem sessão', async () => {
    const response = await request(app).get('/dashboard');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Não autenticado' });
  });

  it('retorna 200 com user e ledger_entries autenticado', async () => {
    const ledgerEntries = [
      {
        id: 2,
        kind: 'transfer_credit',
        amountCents: 5_000,
        balanceAfterCents: 35_000,
        createdAt: new Date('2026-06-17T14:00:00.000Z'),
      },
      {
        id: 1,
        kind: 'opening_balance',
        amountCents: 30_000,
        balanceAfterCents: 30_000,
        createdAt: new Date('2026-06-17T12:00:00.000Z'),
      },
    ];

    const { agent } = await createAuthenticatedAgent(app);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      name: 'Ana',
      email: 'ana@test.com',
      phone: '+5511999990000',
      balanceCents: 35_000,
      paymentKey: '00000000-0000-4000-8000-000000000000',
    });
    mockPrisma.ledgerEntry.findMany.mockResolvedValue(ledgerEntries);

    const response = await agent.get('/dashboard');

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: 1,
      name: 'Ana',
      email: 'ana@test.com',
      phone: '+5511999990000',
      balance_cents: 35_000,
      payment_key: '00000000-0000-4000-8000-000000000000',
    });
    expect(response.body.ledger_entries).toEqual([
      {
        id: 2,
        kind: 'transfer_credit',
        amount_cents: 5_000,
        balance_after_cents: 35_000,
        created_at: '2026-06-17T14:00:00.000Z',
      },
      {
        id: 1,
        kind: 'opening_balance',
        amount_cents: 30_000,
        balance_after_cents: 30_000,
        created_at: '2026-06-17T12:00:00.000Z',
      },
    ]);
  });

  it('consulta extrato com take: 15', async () => {
    const { agent } = await createAuthenticatedAgent(app);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      name: 'Ana',
      email: 'ana@test.com',
      phone: '+5511999990000',
      balanceCents: 30_000,
      paymentKey: '00000000-0000-4000-8000-000000000000',
    });
    mockPrisma.ledgerEntry.findMany.mockResolvedValue([]);

    await agent.get('/dashboard');

    expect(mockPrisma.ledgerEntry.findMany).toHaveBeenCalledWith({
      where: { accountType: 'User', accountId: 1 },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
  });

  it('reflete balance_cents do banco, não da sessão', async () => {
    const { agent } = await createAuthenticatedAgent(app, { balanceCents: 30_000 });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      name: 'Ana',
      email: 'ana@test.com',
      phone: '+5511999990000',
      balanceCents: 99_999,
      paymentKey: '00000000-0000-4000-8000-000000000000',
    });
    mockPrisma.ledgerEntry.findMany.mockResolvedValue([]);

    const response = await agent.get('/dashboard');

    expect(response.status).toBe(200);
    expect(response.body.user.balance_cents).toBe(99_999);
  });
});
