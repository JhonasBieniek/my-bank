jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-4000-8000-000000000002'),
}));

jest.mock('../../src/middleware/rateLimit', () => ({
  loginLimiter: (_req, _res, next) => next(),
  registerLimiter: (_req, _res, next) => next(),
}));

jest.mock('../../src/lib/prisma', () => ({
  prisma: require('../helpers/prismaMock').mockPrisma,
}));

jest.mock('../../src/services/productService', () => ({
  listActiveProducts: jest.fn(),
  listSellerProducts: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
}));

jest.mock('../../src/services/purchaseService', () => ({
  purchase: jest.fn(),
}));

const request = require('supertest');
const { mockPrisma, resetPrismaMock } = require('../helpers/prismaMock');
const { createAuthenticatedAgent } = require('../helpers/session');
const { app } = require('../helpers/app');
const {
  listActiveProducts,
  listSellerProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../../src/services/productService');
const { purchase } = require('../../src/services/purchaseService');

describe('GET /store/products', () => {
  beforeEach(() => {
    resetPrismaMock();
    listActiveProducts.mockReset();
    mockPrisma.storeTreasury.findUnique.mockResolvedValue({ id: 1, balanceCents: 78 });
  });

  it('retorna produtos ativos sanitizados sem sessão', async () => {
    listActiveProducts.mockResolvedValue({
      ok: true,
      value: {
        products: [
          {
            id: 1,
            name: 'Café',
            description: 'Grãos',
            priceCents: 1_990,
            imageUrl: null,
            cashbackPercent: 5,
            seller: { name: 'Bruno' },
          },
        ],
        pagination: {
          page: 1,
          per_page: 16,
          total: 1,
          total_pages: 1,
        },
      },
    });

    const response = await request(app).get('/store/products');

    expect(response.status).toBe(200);
    expect(listActiveProducts).toHaveBeenCalledWith({
      excludeSellerId: undefined,
      page: 1,
      perPage: 16,
    });
    expect(response.body).toEqual({
      products: [
        {
          id: 1,
          name: 'Café',
          description: 'Grãos',
          price_cents: 1_990,
          image_url: null,
          cashback_percent: 5,
          seller_name: 'B*** B***',
        },
      ],
      pagination: {
        page: 1,
        per_page: 16,
        total: 1,
        total_pages: 1,
      },
      treasury_balance_cents: 78,
    });
  });

  it('exclui produtos do usuário autenticado e repassa paginação', async () => {
    const { agent, user } = await createAuthenticatedAgent(app);
    listActiveProducts.mockResolvedValue({
      ok: true,
      value: {
        products: [],
        pagination: {
          page: 2,
          per_page: 16,
          total: 20,
          total_pages: 2,
        },
      },
    });

    const response = await agent.get('/store/products?page=2&per_page=8');

    expect(response.status).toBe(200);
    expect(listActiveProducts).toHaveBeenCalledWith({
      excludeSellerId: user.id,
      page: 2,
      perPage: 8,
    });
    expect(response.body.pagination).toEqual({
      page: 2,
      per_page: 16,
      total: 20,
      total_pages: 2,
    });
  });
});

describe('POST /store/products', () => {
  beforeEach(() => {
    resetPrismaMock();
    createProduct.mockReset();
  });

  it('retorna 422 quando validação Zod falha', async () => {
    const { agent } = await createAuthenticatedAgent(app);

    const response = await agent.post('/store/products').field('name', '').field('price', '');

    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('rejeita nome com tags HTML', async () => {
    const { agent } = await createAuthenticatedAgent(app);

    const response = await agent
      .post('/store/products')
      .field('name', '<script>alert(1)</script>')
      .field('price', '10,00');

    expect(response.status).toBe(422);
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('cria produto autenticado', async () => {
    const { agent, user } = await createAuthenticatedAgent(app);
    createProduct.mockResolvedValue({
      ok: true,
      value: {
        id: 3,
        name: 'Café',
        description: null,
        priceCents: 1_990,
        imageUrl: null,
        cashbackPercent: 5,
        active: true,
      },
    });

    const response = await agent
      .post('/store/products')
      .field('name', 'Café')
      .field('price', '19,90')
      .field('cashback_percent', 5);

    expect(response.status).toBe(201);
    expect(createProduct).toHaveBeenCalledWith(user.id, {
      name: 'Café',
      description: undefined,
      price: '19,90',
      imageFilename: undefined,
      cashbackPercent: 5,
      active: true,
    });
    expect(response.body.product.active).toBe(true);
  });
});

describe('PUT /store/products/:id', () => {
  beforeEach(() => {
    resetPrismaMock();
    updateProduct.mockReset();
  });

  it('retorna 403 quando não é dono', async () => {
    const { agent, user } = await createAuthenticatedAgent(app);
    updateProduct.mockResolvedValue({
      ok: false,
      error: { message: 'Você não pode editar este produto', code: 'forbidden' },
    });

    const response = await agent.put('/store/products/9').field('active', 'false');

    expect(response.status).toBe(403);
    expect(updateProduct).toHaveBeenCalledWith(user.id, 9, {
      name: undefined,
      description: undefined,
      price: undefined,
      imageFilename: undefined,
      removeImage: undefined,
      cashbackPercent: undefined,
      active: false,
    });
  });
});

describe('DELETE /store/products/:id', () => {
  beforeEach(() => {
    resetPrismaMock();
    deleteProduct.mockReset();
  });

  it('retorna 403 quando não é dono', async () => {
    const { agent, user } = await createAuthenticatedAgent(app);
    deleteProduct.mockResolvedValue({
      ok: false,
      error: { message: 'Você não pode remover este produto', code: 'forbidden' },
    });

    const response = await agent.delete('/store/products/9');

    expect(response.status).toBe(403);
    expect(deleteProduct).toHaveBeenCalledWith(user.id, 9);
  });
});

describe('GET /store/products/mine', () => {
  beforeEach(() => {
    resetPrismaMock();
    listSellerProducts.mockReset();
  });

  it('lista produtos do vendedor com active', async () => {
    const { agent, user } = await createAuthenticatedAgent(app);
    listSellerProducts.mockResolvedValue({
      ok: true,
      value: [
        {
          id: 2,
          name: 'Inativo',
          description: null,
          priceCents: 500,
          imageUrl: null,
          cashbackPercent: 0,
          active: false,
        },
      ],
    });

    const response = await agent.get('/store/products/mine');

    expect(response.status).toBe(200);
    expect(listSellerProducts).toHaveBeenCalledWith(user.id);
    expect(response.body.products[0].active).toBe(false);
  });
});

describe('POST /store/products/:id/purchase', () => {
  beforeEach(() => {
    resetPrismaMock();
    purchase.mockReset();
  });

  it('retorna 401 sem sessão', async () => {
    const response = await request(app).post('/store/products/1/purchase').send({});

    expect(response.status).toBe(401);
    expect(purchase).not.toHaveBeenCalled();
  });

  it('retorna 422 com saldo insuficiente', async () => {
    const { agent, user } = await createAuthenticatedAgent(app);
    purchase.mockResolvedValue({
      ok: false,
      error: { message: 'Saldo insuficiente', code: 'insufficient_funds' },
    });

    const response = await agent.post('/store/products/1/purchase').send({});

    expect(response.status).toBe(422);
    expect(purchase).toHaveBeenCalledWith({
      buyer: user,
      productId: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000002',
    });
  });

  it('retorna 201 com compra criada', async () => {
    const { agent, user } = await createAuthenticatedAgent(app);
    purchase.mockResolvedValue({
      ok: true,
      value: {
        id: 7,
        grossCents: 1_990,
        feeCents: 39,
        cashbackCents: 99,
        sellerNetCents: 1_852,
      },
    });
    mockPrisma.product.findUnique.mockResolvedValue({ id: 1, name: 'Café' });

    const response = await agent.post('/store/products/1/purchase').send({
      idempotency_key: '00000000-0000-4000-8000-000000000002',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      purchase: {
        id: 7,
        amount_cents: 1_990,
        fee_cents: 39,
        cashback_cents: 99,
        seller_net_cents: 1_852,
        product_name: 'Café',
      },
    });
    expect(purchase).toHaveBeenCalledWith({
      buyer: user,
      productId: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000002',
    });
  });
});
