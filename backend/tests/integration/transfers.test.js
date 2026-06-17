jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-4000-8000-000000000001'),
}));

jest.mock('../../src/middleware/rateLimit', () => ({
  loginLimiter: (_req, _res, next) => next(),
  registerLimiter: (_req, _res, next) => next(),
}));

jest.mock('../../src/lib/prisma', () => ({
  prisma: require('../helpers/prismaMock').mockPrisma,
}));

jest.mock('../../src/services/transferService', () => ({
  transfer: jest.fn(),
}));

const request = require('supertest');
const { mockPrisma, resetPrismaMock } = require('../helpers/prismaMock');
const { createAuthenticatedAgent } = require('../helpers/session');
const { app } = require('../helpers/app');
const { transfer } = require('../../src/services/transferService');

describe('POST /transfers', () => {
  beforeEach(() => {
    resetPrismaMock();
    transfer.mockReset();
  });

  it('retorna 401 sem sessão', async () => {
    const response = await request(app).post('/transfers').send({
      payee_identifier: 'bruno@demo.mybank.local',
      amount: '10,00',
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Não autenticado' });
    expect(transfer).not.toHaveBeenCalled();
  });

  it('retorna 422 quando validação Zod falha', async () => {
    const { agent } = await createAuthenticatedAgent(app);

    const response = await agent.post('/transfers').send({
      payee_identifier: '',
      amount: '',
    });

    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
    expect(transfer).not.toHaveBeenCalled();
  });

  it('retorna 422 quando valor é inválido', async () => {
    const { agent } = await createAuthenticatedAgent(app);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      name: 'Ana',
      email: 'ana@test.com',
      balanceCents: 30_000,
    });

    const response = await agent.post('/transfers').send({
      payee_identifier: 'bruno@demo.mybank.local',
      amount: 'abc',
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ message: 'Valor inválido' });
    expect(transfer).not.toHaveBeenCalled();
  });

  it('retorna 422 com saldo insuficiente', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const sender = {
      id: 1,
      name: 'Ana',
      email: 'ana@test.com',
      balanceCents: 100,
    };

    mockPrisma.user.findUnique.mockResolvedValue(sender);
    transfer.mockResolvedValue({
      ok: false,
      error: { message: 'Saldo insuficiente', code: 'insufficient_funds' },
    });

    const response = await agent.post('/transfers').send({
      payee_identifier: 'bruno@demo.mybank.local',
      amount: '500,00',
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ message: 'Saldo insuficiente' });
    expect(transfer).toHaveBeenCalledWith({
      sender,
      payeeIdentifier: 'bruno@demo.mybank.local',
      amountCents: 50_000,
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    });
  });

  it('retorna 201 com transferência criada', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const sender = {
      id: 1,
      name: 'Ana',
      email: 'ana@test.com',
      balanceCents: 30_000,
    };

    mockPrisma.user.findUnique
      .mockResolvedValueOnce(sender)
      .mockResolvedValueOnce({ id: 2, name: 'Bruno' });
    transfer.mockResolvedValue({
      ok: true,
      value: {
        id: 10,
        senderId: 1,
        recipientId: 2,
        amountCents: 2_990,
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      },
    });

    const response = await agent.post('/transfers').send({
      payee_identifier: 'bruno@demo.mybank.local',
      amount: '29,90',
      idempotency_key: '00000000-0000-4000-8000-000000000001',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      transfer: {
        id: 10,
        amount_cents: 2_990,
        recipient_name: 'Br***',
      },
    });
    expect(transfer).toHaveBeenCalledWith({
      sender,
      payeeIdentifier: 'bruno@demo.mybank.local',
      amountCents: 2_990,
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    });
  });
});
