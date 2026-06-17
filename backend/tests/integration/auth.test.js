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
const bcrypt = require('bcrypt');
const { mockPrisma, createTxMock, resetPrismaMock } = require('../helpers/prismaMock');
const { createAuthenticatedAgent } = require('../helpers/session');
const { app } = require('../helpers/app');
const { OPENING_BALANCE_CENTS } = require('../../src/lib/constants');

const validRegisterPayload = {
  user: {
    name: 'Ana',
    email: 'ana@test.com',
    phone: '11999990000',
    password: 'senha1234',
    password_confirmation: 'senha1234',
  },
};

function mockSuccessfulRegister(userOverrides = {}) {
  const createdUser = {
    id: 1,
    name: 'Ana',
    email: 'ana@test.com',
    phone: '+5511999990000',
    passwordDigest: 'hash',
    paymentKey: '00000000-0000-4000-8000-000000000000',
    balanceCents: OPENING_BALANCE_CENTS,
    ...userOverrides,
  };

  const tx = createTxMock();
  tx.user.create.mockResolvedValue({ ...createdUser, balanceCents: 0 });
  tx.user.update.mockResolvedValue(createdUser);
  tx.user.findUniqueOrThrow.mockResolvedValue(createdUser);
  tx.ledgerEntry.create.mockResolvedValue({ id: 1 });

  mockPrisma.$transaction.mockImplementation(async (callback) => callback(tx));

  return { createdUser, tx };
}

describe('POST /auth/register', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('retorna 201 com user sem campos de senha', async () => {
    mockSuccessfulRegister();

    const response = await request(app).post('/auth/register').send(validRegisterPayload);

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({
      id: 1,
      name: 'Ana',
      email: 'ana@test.com',
      phone: '+5511999990000',
      balance_cents: OPENING_BALANCE_CENTS,
      payment_key: '00000000-0000-4000-8000-000000000000',
    });
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordDigest');
    expect(response.body.user).not.toHaveProperty('password_digest');
  });

  it('retorna 422 em cadastro duplicado', async () => {
    const error = Object.assign(new Error('Unique constraint'), {
      code: 'P2002',
      meta: { target: ['email'] },
    });
    mockPrisma.$transaction.mockRejectedValue(error);

    const response = await request(app).post('/auth/register').send(validRegisterPayload);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ message: 'E-mail já cadastrado' });
  });

  it('retorna 422 quando a senha é curta', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        user: {
          ...validRegisterPayload.user,
          password: 'curta',
          password_confirmation: 'curta',
        },
      });

    expect(response.status).toBe(422);
    expect(response.body.message).toContain('8 caracteres');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('retorna 200 e mantém sessão no agent', async () => {
    const passwordDigest = await bcrypt.hash('senha1234', 12);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      name: 'Ana',
      email: 'ana@test.com',
      phone: '+5511999990000',
      balanceCents: OPENING_BALANCE_CENTS,
      paymentKey: '00000000-0000-4000-8000-000000000000',
      passwordDigest,
    });

    const agent = request.agent(app);
    const loginResponse = await agent
      .post('/auth/login')
      .send({ email: 'ana@test.com', password: 'senha1234' });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.email).toBe('ana@test.com');

    const meResponse = await agent.get('/auth/me');
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.id).toBe(1);
  });

  it('retorna 401 com senha incorreta', async () => {
    const passwordDigest = await bcrypt.hash('senha1234', 12);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'ana@test.com',
      passwordDigest,
    });

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'ana@test.com', password: 'senhaerrada' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'E-mail ou senha inválidos' });
  });
});

describe('GET /auth/me', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('retorna 401 sem sessão', async () => {
    const response = await request(app).get('/auth/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Não autenticado' });
  });

  it('retorna 200 com sessão válida', async () => {
    const { agent } = await createAuthenticatedAgent(app);

    const response = await agent.get('/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: 1,
      email: 'ana@test.com',
      balance_cents: 30_000,
    });
  });
});

describe('POST /auth/logout', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('retorna 204 e encerra a sessão', async () => {
    const { agent } = await createAuthenticatedAgent(app);

    const logoutResponse = await agent.post('/auth/logout');
    expect(logoutResponse.status).toBe(204);

    const meResponse = await agent.get('/auth/me');
    expect(meResponse.status).toBe(401);
    expect(meResponse.body).toEqual({ message: 'Não autenticado' });
  });
});
