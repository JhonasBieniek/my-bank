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
  product: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  purchase: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  storeTreasury: {
    findUnique: jest.fn(),
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
  mockPrisma.product.findMany.mockReset();
  mockPrisma.product.findUnique.mockReset();
  mockPrisma.product.create.mockReset();
  mockPrisma.product.update.mockReset();
  mockPrisma.product.delete.mockReset();
  mockPrisma.purchase.findUnique.mockReset();
  mockPrisma.purchase.create.mockReset();
  mockPrisma.storeTreasury.findUnique.mockReset();
}

module.exports = { mockPrisma, createTxMock, resetPrismaMock };
