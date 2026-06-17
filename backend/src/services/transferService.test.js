jest.mock('./registerAccountService', () => ({
  normalizeEmail: (email) => email.trim().toLowerCase(),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    transfer: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('./baseService', () => ({
  InsufficientFundsError: class InsufficientFundsError extends Error {
    constructor(message = 'Saldo insuficiente') {
      super(message);
      this.name = 'InsufficientFundsError';
    }
  },
  withWalletTransaction: jest.fn(),
  lockUser: jest.fn(),
  applyUserBalance: jest.fn(),
  recordLedgerEntry: jest.fn(),
}));

const { prisma } = require('../lib/prisma');
const {
  withWalletTransaction,
  lockUser,
  applyUserBalance,
  recordLedgerEntry,
  InsufficientFundsError,
} = require('./baseService');
const { findUserByPayeeIdentifier, transfer } = require('./transferService');

describe('findUserByPayeeIdentifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('busca por e-mail normalizado', async () => {
    const user = { id: 2, email: 'bruno@demo.mybank.local' };
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await findUserByPayeeIdentifier(' Bruno@demo.mybank.local ');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'bruno@demo.mybank.local' },
    });
    expect(result).toBe(user);
  });

  it('busca por payment_key', async () => {
    const user = { id: 2, paymentKey: '22222222-2222-2222-2222-222222222222' };
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await findUserByPayeeIdentifier('22222222-2222-2222-2222-222222222222');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { paymentKey: '22222222-2222-2222-2222-222222222222' },
    });
    expect(result).toBe(user);
  });
});

describe('transfer', () => {
  const sender = { id: 1, balanceCents: 30_000 };
  const recipient = { id: 2, paymentKey: '22222222-2222-2222-2222-222222222222' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.transfer.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(recipient);
  });

  it('retorna transferência existente por idempotency_key', async () => {
    const existing = { id: 10, idempotencyKey: 'same-key' };
    prisma.transfer.findUnique.mockResolvedValue(existing);

    const result = await transfer({
      sender,
      payeeIdentifier: recipient.paymentKey,
      amountCents: 500,
      idempotencyKey: 'same-key',
    });

    expect(result).toEqual({ ok: true, value: existing });
    expect(withWalletTransaction).not.toHaveBeenCalled();
  });

  it('falha quando destinatário não existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await transfer({
      sender,
      payeeIdentifier: 'inexistente@demo.mybank.local',
      amountCents: 500,
      idempotencyKey: 'key-1',
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('payee_not_found');
  });

  it('falha ao transferir para si mesmo', async () => {
    prisma.user.findUnique.mockResolvedValue(sender);

    const result = await transfer({
      sender,
      payeeIdentifier: 'ana@demo.mybank.local',
      amountCents: 500,
      idempotencyKey: 'key-2',
    });

    expect(result.ok).toBe(false);
    expect(result.error.message).toBe('Não é possível transferir para si mesmo');
  });

  it('falha com saldo insuficiente', async () => {
    withWalletTransaction.mockImplementation(async (callback) => {
      lockUser
        .mockResolvedValueOnce({ id: 1, balanceCents: 100 })
        .mockResolvedValueOnce({ id: 2, balanceCents: 30_000 });
      return callback({});
    });

    const result = await transfer({
      sender,
      payeeIdentifier: recipient.paymentKey,
      amountCents: 500,
      idempotencyKey: 'key-3',
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('insufficient_funds');
  });

  it('cria transferência com ledger debit/credit', async () => {
    const createdTransfer = {
      id: 99,
      senderId: 1,
      recipientId: 2,
      amountCents: 500,
      idempotencyKey: 'key-4',
    };

    const tx = {
      transfer: {
        create: jest.fn().mockResolvedValue(createdTransfer),
      },
    };

    withWalletTransaction.mockImplementation(async (callback) => callback(tx));
    lockUser
      .mockResolvedValueOnce({ id: 1, balanceCents: 30_000 })
      .mockResolvedValueOnce({ id: 2, balanceCents: 30_000 });
    applyUserBalance.mockResolvedValueOnce(29_500).mockResolvedValueOnce(30_500);

    const result = await transfer({
      sender,
      payeeIdentifier: recipient.paymentKey,
      amountCents: 500,
      idempotencyKey: 'key-4',
    });

    expect(result.ok).toBe(true);
    expect(tx.transfer.create).toHaveBeenCalledWith({
      data: {
        senderId: 1,
        recipientId: 2,
        amountCents: 500,
        idempotencyKey: 'key-4',
      },
    });
    expect(recordLedgerEntry).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        accountId: 1,
        kind: 'transfer_debit',
        amountCents: -500,
        balanceAfterCents: 29_500,
      })
    );
    expect(recordLedgerEntry).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        accountId: 2,
        kind: 'transfer_credit',
        amountCents: 500,
        balanceAfterCents: 30_500,
      })
    );
  });
});
