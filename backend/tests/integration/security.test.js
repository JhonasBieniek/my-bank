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
const { app } = require('../helpers/app');

describe('segurança HTTP', () => {
  it('aplica headers de segurança via helmet', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});
