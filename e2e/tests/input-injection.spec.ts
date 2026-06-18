import { test, expect } from '@playwright/test';

import { ANA } from '../helpers/constants';
import {
  apiRequest,
  disposeSessionCache,
  getAuthenticatedContext,
  getBalance,
  newApiContext,
  randomUuid,
} from '../helpers/api';
import { assertBalanceIntegrity, assertClientError, assertNoServerError } from '../helpers/assertions';

test.describe.configure({ mode: 'serial' });

test.describe('Atacante malicioso — injeção de entrada', () => {
  const xssPayload = '<script>window.__xssPwned=true</script>';
  const sqlPayload = "' OR '1'='1' --";

  test.afterAll(async () => {
    await disposeSessionCache();
  });

  test('rejeita ou armazena XSS no cadastro de produto sem erro de servidor', async () => {
    const ana = await getAuthenticatedContext(ANA.email);
    const balanceBefore = await getBalance(ana);

    const response = await apiRequest(ana, 'POST', '/store/products', {
      data: {
        name: xssPayload,
        description: `desc ${xssPayload}`,
        price: '9,99',
        cashback_percent: 0,
        active: true,
      },
    });
    const text = await response.text();
    assertNoServerError(response.status(), text);

    if (response.status() === 201) {
      const body = JSON.parse(text) as { product: { name: string; description: string } };
      expect(typeof body.product.name).toBe('string');
      // Execução no DOM é verificada em browser-security.spec.ts (Angular escapa HTML).
    } else {
      assertClientError(response.status(), text);
    }

    await assertBalanceIntegrity(ana);
    expect(await getBalance(ana)).toBe(balanceBefore);
  });

  test('SQL injection em login não causa erro 500', async () => {
    const guest = await newApiContext();
    const response = await guest.post('/auth/login', {
      data: {
        email: `${sqlPayload}@evil.local`,
        password: sqlPayload,
      },
    });
    const text = await response.text();
    assertClientError(response.status(), text);
    expect([401, 422]).toContain(response.status());
    await guest.dispose();
  });

  test('SQL injection em payee_identifier não vaza dados nem causa 500', async () => {
    const ana = await getAuthenticatedContext(ANA.email);
    const response = await apiRequest(ana, 'POST', '/transfers', {
      data: {
        payee_identifier: sqlPayload,
        amount: '1,00',
        idempotency_key: randomUuid(),
      },
    });
    const text = await response.text();
    assertClientError(response.status(), text);
    expect(response.status()).toBe(422);
    expect(text).not.toMatch(/syntax|sql|mysql/i);
    await assertBalanceIntegrity(ana);
  });

  test('rejeita corpo JSON acima de 64kb', async () => {
    const guest = await newApiContext();
    const oversized = JSON.stringify({
      email: 'a@b.com',
      password: 'x'.repeat(70 * 1024),
    });

    const response = await guest.post('/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: oversized,
    });
    const text = await response.text();
    expect([413, 422]).toContain(response.status());
    assertNoServerError(response.status(), text);
    await guest.dispose();
  });

  test('rejeita idempotency_key com UUID inválido', async () => {
    const ana = await getAuthenticatedContext(ANA.email);
    const response = await apiRequest(ana, 'POST', '/transfers', {
      data: {
        payee_identifier: '22222222-2222-2222-2222-222222222222',
        amount: '1,00',
        idempotency_key: 'nao-e-uuid',
      },
    });
    const text = await response.text();
    assertClientError(response.status(), text);
    expect(response.status()).toBe(422);
    await assertBalanceIntegrity(ana);
  });
});
