const request = require('supertest');
const bcrypt = require('bcrypt');
const { prisma } = require('../../src/lib/prisma');

const TEST_USER = {
  id: 1,
  name: 'Ana',
  email: 'ana@test.com',
  phone: '+5511999990000',
  balanceCents: 30_000,
  paymentKey: '00000000-0000-4000-8000-000000000000',
};

async function createAuthenticatedAgent(app, overrides = {}) {
  const user = { ...TEST_USER, ...overrides };
  const passwordDigest = await bcrypt.hash('senha1234', 12);
  const dbUser = { ...user, passwordDigest };

  prisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.id === dbUser.id || where.email === dbUser.email) {
      return Promise.resolve(dbUser);
    }
    return Promise.resolve(null);
  });

  const agent = request.agent(app);
  const loginResponse = await agent
    .post('/auth/login')
    .send({ email: dbUser.email, password: 'senha1234' });

  if (loginResponse.status !== 200) {
    throw new Error(`Falha ao autenticar agent de teste: ${loginResponse.status}`);
  }

  return { agent, user: dbUser };
}

module.exports = { createAuthenticatedAgent, TEST_USER };
