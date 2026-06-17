jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}));

jest.mock('./baseService', () => ({
  withWalletTransaction: jest.fn(),
  applyUserBalance: jest.fn(),
  recordLedgerEntry: jest.fn(),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

const {
  withWalletTransaction,
  applyUserBalance,
  recordLedgerEntry,
} = require('./baseService');
const { v4: uuidv4 } = require('uuid');
const { registerAccount } = require('./registerAccountService');
const { OPENING_BALANCE_CENTS } = require('../lib/constants');

describe('registerAccount', () => {
  beforeEach(() => {
    uuidv4.mockReturnValue('00000000-0000-4000-8000-000000000000');
  });

  it('cria user e ledger em transação com sucesso', async () => {
    const createdUser = {
      id: 1,
      name: 'Ana',
      email: 'ana@test.com',
      phone: '+5511999990000',
      passwordDigest: 'hash',
      paymentKey: '00000000-0000-4000-8000-000000000000',
      balanceCents: OPENING_BALANCE_CENTS,
    };

    const tx = {
      user: {
        create: jest.fn().mockResolvedValue({ ...createdUser, balanceCents: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(createdUser),
      },
    };

    withWalletTransaction.mockImplementation(async (callback) => callback(tx));
    applyUserBalance.mockResolvedValue(OPENING_BALANCE_CENTS);
    recordLedgerEntry.mockResolvedValue({ id: 1 });

    const result = await registerAccount({
      name: 'Ana',
      email: 'ana@test.com',
      phone: '11999990000',
      password: 'senha1234',
    });

    expect(result.ok).toBe(true);
    expect(result.value).toEqual(createdUser);
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'ana@test.com',
          phone: '+5511999990000',
          balanceCents: 0,
        }),
      })
    );
    expect(applyUserBalance).toHaveBeenCalledWith(tx, 1, 0, OPENING_BALANCE_CENTS);
    expect(recordLedgerEntry).toHaveBeenCalled();
  });

  it('retorna 422 para telefone inválido', async () => {
    const result = await registerAccount({
      name: 'Ana',
      email: 'ana@test.com',
      phone: 'abc',
      password: 'senha1234',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toEqual({ status: 422, message: 'Telefone inválido' });
    expect(withWalletTransaction).not.toHaveBeenCalled();
  });

  it('retorna mensagem de e-mail já cadastrado em P2002 de email', async () => {
    const error = Object.assign(new Error('Unique constraint'), {
      code: 'P2002',
      meta: { target: ['email'] },
    });
    withWalletTransaction.mockRejectedValue(error);

    const result = await registerAccount({
      name: 'Ana',
      email: 'ana@test.com',
      phone: '11999990000',
      password: 'senha1234',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toEqual({ status: 422, message: 'E-mail já cadastrado' });
  });

  it('retorna mensagem de telefone já cadastrado em P2002 de phone', async () => {
    const error = Object.assign(new Error('Unique constraint'), {
      code: 'P2002',
      meta: { target: ['phone'] },
    });
    withWalletTransaction.mockRejectedValue(error);

    const result = await registerAccount({
      name: 'Ana',
      email: 'ana@test.com',
      phone: '11999990000',
      password: 'senha1234',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toEqual({ status: 422, message: 'Telefone já cadastrado' });
  });

  it('executa user.create e recordLedgerEntry na mesma transação', async () => {
    const tx = {
      user: {
        create: jest.fn().mockResolvedValue({
          id: 1,
          name: 'Ana',
          email: 'ana@test.com',
          phone: '+5511999990000',
          balanceCents: 0,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 1,
          name: 'Ana',
          email: 'ana@test.com',
          phone: '+5511999990000',
          balanceCents: OPENING_BALANCE_CENTS,
        }),
      },
    };

    withWalletTransaction.mockImplementation(async (callback) => callback(tx));
    applyUserBalance.mockResolvedValue(OPENING_BALANCE_CENTS);
    recordLedgerEntry.mockResolvedValue({ id: 1 });

    await registerAccount({
      name: 'Ana',
      email: 'ana@test.com',
      phone: '11999990000',
      password: 'senha1234',
    });

    expect(withWalletTransaction).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(recordLedgerEntry).toHaveBeenCalledTimes(1);
    expect(recordLedgerEntry).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        accountType: 'User',
        accountId: 1,
        kind: 'opening_balance',
      })
    );
  });
});
