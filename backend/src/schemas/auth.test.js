const { registerSchema } = require('./auth');

describe('registerSchema', () => {
  const validPayload = {
    user: {
      name: 'Ana',
      email: 'ana@test.com',
      phone: '11999990000',
      password: 'senha1234',
      password_confirmation: 'senha1234',
    },
  };

  it('aceita payload válido', () => {
    const result = registerSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('rejeita senha com menos de 8 caracteres', () => {
    const result = registerSchema.safeParse({
      user: {
        ...validPayload.user,
        password: 'curta',
        password_confirmation: 'curta',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.message.includes('8 caracteres'))).toBe(
      true
    );
  });
});
