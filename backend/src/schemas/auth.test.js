const { registerSchema, loginSchema } = require('./auth');

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

  it('rejeita campos obrigatórios ausentes', () => {
    const result = registerSchema.safeParse({ user: { name: 'Ana' } });

    expect(result.success).toBe(false);
    expect(result.error.issues.length).toBeGreaterThan(0);
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

  it('rejeita password_confirmation divergente', () => {
    const result = registerSchema.safeParse({
      user: {
        ...validPayload.user,
        password_confirmation: 'outrasenha',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.message === 'As senhas não conferem')).toBe(
      true
    );
  });
});

describe('loginSchema', () => {
  it('rejeita e-mail inválido', () => {
    const result = loginSchema.safeParse({ email: 'nao-e-email', password: 'senha1234' });

    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.message === 'E-mail inválido')).toBe(true);
  });

  it('rejeita senha vazia', () => {
    const result = loginSchema.safeParse({ email: 'ana@test.com', password: '' });

    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.message === 'Senha é obrigatória')).toBe(
      true
    );
  });
});
