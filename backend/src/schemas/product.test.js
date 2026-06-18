const { productCreateSchema } = require('./product');

describe('productCreateSchema', () => {
  it('aceita payload válido sem imagem', () => {
    const result = productCreateSchema.safeParse({
      name: 'Café',
      price: '19,90',
      cashback_percent: '5',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: 'Café',
      price: '19,90',
      cashback_percent: 5,
      active: true,
    });
  });

  it('rejeita cashback acima do máximo permitido', () => {
    const result = productCreateSchema.safeParse({
      name: 'Café',
      price: '10,00',
      cashback_percent: 99,
    });

    expect(result.success).toBe(false);
  });

  it('rejeita nome com tags HTML', () => {
    const result = productCreateSchema.safeParse({
      name: '<script>alert(1)</script>',
      price: '10,00',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === 'Não pode conter tags HTML')).toBe(
        true
      );
    }
  });

  it('rejeita descrição com tags HTML', () => {
    const result = productCreateSchema.safeParse({
      name: 'Café',
      description: '<img src=x onerror=alert(1)>',
      price: '10,00',
    });

    expect(result.success).toBe(false);
  });
});
