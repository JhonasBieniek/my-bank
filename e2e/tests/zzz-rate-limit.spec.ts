import { test, expect } from '@playwright/test';

import { newApiContext } from '../helpers/api';

// Executado por último (prefixo 99-) para não bloquear logins legítimos nos demais testes.
test.describe('Atacante malicioso — rate limit de autenticação', () => {
  test('rate limit em /auth/login após 11+ tentativas falhas', async () => {
    const guest = await newApiContext();
    const attempts = 12;
    const statuses: number[] = [];

    for (let index = 0; index < attempts; index += 1) {
      const response = await guest.post('/auth/login', {
        data: {
          email: `rate-limit-${index}@evil.local`,
          password: 'senha-invalida',
        },
      });
      statuses.push(response.status());
    }

    expect(statuses.filter((status) => status === 429).length).toBeGreaterThanOrEqual(1);
    expect(statuses[statuses.length - 1]).toBe(429);

    await guest.dispose();
  });
});
