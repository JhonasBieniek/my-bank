const { sanitizeUser } = require('./sanitizeUser');

describe('sanitizeUser', () => {
  it('nunca expõe passwordDigest ou password_digest', () => {
    const sanitized = sanitizeUser({
      id: 1,
      name: 'Ana',
      email: 'ana@test.com',
      phone: '+5511999990000',
      balanceCents: 30_000,
      paymentKey: 'chave-pagamento',
      passwordDigest: 'hash-secreto',
      password_digest: 'hash-legado',
    });

    expect(sanitized).not.toHaveProperty('passwordDigest');
    expect(sanitized).not.toHaveProperty('password_digest');
  });

  it('serializa campos em snake_case correto', () => {
    expect(
      sanitizeUser({
        id: 42,
        name: 'Bruno',
        email: 'bruno@test.com',
        phone: '+5511888887777',
        balanceCents: 50_000,
        paymentKey: 'uuid-de-pagamento',
      })
    ).toEqual({
      id: 42,
      name: 'Bruno',
      email: 'bruno@test.com',
      phone: '+5511888887777',
      balance_cents: 50_000,
      payment_key: 'uuid-de-pagamento',
    });
  });
});
