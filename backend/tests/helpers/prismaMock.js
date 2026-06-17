const mockPrisma = {
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  ledgerEntry: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

function createTxMock() {
  return {
    user: {
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    ledgerEntry: { create: jest.fn() },
  };
}

function resetPrismaMock() {
  mockPrisma.$transaction.mockReset();
  mockPrisma.$queryRaw.mockReset();
  mockPrisma.user.findUnique.mockReset();
  mockPrisma.user.create.mockReset();
  mockPrisma.ledgerEntry.findMany.mockReset();
  mockPrisma.ledgerEntry.create.mockReset();
}

module.exports = { mockPrisma, createTxMock, resetPrismaMock };
