const { calculatePurchaseSplit, getMaxCashbackPercent } = require('./purchaseSplit');

describe('calculatePurchaseSplit', () => {
  it('calcula taxa, cashback e líquido do vendedor com divisão inteira', () => {
    const split = calculatePurchaseSplit({ priceCents: 1_990, cashbackPercent: 5 });

    expect(split).toEqual({
      grossCents: 1_990,
      feeCents: 39,
      cashbackCents: 99,
      sellerNetCents: 1_852,
    });
  });

  it('retorna cashback zero quando percentual é zero', () => {
    const split = calculatePurchaseSplit({ priceCents: 10_000, cashbackPercent: 0 });

    expect(split).toEqual({
      grossCents: 10_000,
      feeCents: 200,
      cashbackCents: 0,
      sellerNetCents: 9_800,
    });
  });

  it('lança erro quando cashback excede o permitido para a taxa da loja', () => {
    expect(() =>
      calculatePurchaseSplit({ priceCents: 100, cashbackPercent: getMaxCashbackPercent() + 1 })
    ).toThrow('Valores da compra inválidos');
  });
});
