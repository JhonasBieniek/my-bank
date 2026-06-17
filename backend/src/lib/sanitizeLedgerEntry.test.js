const { sanitizeLedgerEntry } = require('./sanitizeLedgerEntry');

describe('sanitizeLedgerEntry', () => {
  it('serializa entrada do Prisma em snake_case com created_at ISO', () => {
    const createdAt = new Date('2026-06-17T12:00:00.000Z');

    expect(
      sanitizeLedgerEntry({
        id: 1,
        kind: 'opening_balance',
        amountCents: 30_000,
        balanceAfterCents: 30_000,
        createdAt,
      })
    ).toEqual({
      id: 1,
      kind: 'opening_balance',
      amount_cents: 30_000,
      balance_after_cents: 30_000,
      created_at: '2026-06-17T12:00:00.000Z',
    });
  });
});
