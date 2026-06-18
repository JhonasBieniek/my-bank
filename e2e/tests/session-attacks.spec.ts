import path from 'node:path';

import { test, expect, request } from '@playwright/test';

import { ANA, BRUNO, API_BASE_URL } from '../helpers/constants';
import {
  disposeSessionCache,
  getAuthenticatedContext,
  getBalance,
  newApiContext,
  randomUuid,
  apiRequest,
} from '../helpers/api';
import { assertBalanceIntegrity, assertClientError } from '../helpers/assertions';

test.describe.configure({ mode: 'serial' });

test.describe('Atacante malicioso — sessão', () => {
  test.afterAll(async () => {
    await disposeSessionCache();
  });

  test('cookie de sessão adulterado é rejeitado em rota protegida', async () => {
    const guest = await newApiContext();
    const response = await guest.get('/dashboard', {
      headers: {
        Cookie: 'connect.sid=s%3Afake-session-id.tampered',
      },
    });
    const text = await response.text();
    assertClientError(response.status(), text);
    expect(response.status()).toBe(401);
    await guest.dispose();
  });

  test('logout invalida sessão para operações protegidas', async () => {
    const authPath = path.join(__dirname, '../.auth/ana.json');
    const authed = await request.newContext({
      baseURL: API_BASE_URL,
      storageState: authPath,
      extraHTTPHeaders: { Accept: 'application/json' },
    });

    const me = await authed.get('/auth/me');
    expect(me.ok()).toBeTruthy();

    const logout = await authed.post('/auth/logout');
    expect([204, 200]).toContain(logout.status());

    const dashboard = await authed.get('/dashboard');
    const text = await dashboard.text();
    assertClientError(dashboard.status(), text);
    expect(dashboard.status()).toBe(401);
    await authed.dispose();
  });
});

test.describe('Atacante malicioso — sanidade pós-ataque', () => {
  test.afterAll(async () => {
    await disposeSessionCache();
  });

  test('operação legítima ainda funciona após bateria de ataques', async () => {
    const ana = await getAuthenticatedContext(ANA.email);
    const bruno = await getAuthenticatedContext(BRUNO.email);
    const anaBefore = await getBalance(ana);
    const brunoBefore = await getBalance(bruno);

    const response = await apiRequest(ana, 'POST', '/transfers', {
      data: {
        payee_identifier: BRUNO.paymentKey,
        amount: '0,50',
        idempotency_key: randomUuid(),
      },
    });
    const text = await response.text();
    expect(response.status()).toBe(201);
    expect(text).not.toMatch(/at\s+\w+\s*\(/);

    const anaAfter = await getBalance(ana);
    const brunoAfter = await getBalance(bruno);

    expect(anaAfter).toBe(anaBefore - 50);
    expect(brunoAfter).toBe(brunoBefore + 50);
    await assertBalanceIntegrity(ana);
    await assertBalanceIntegrity(bruno);
  });
});
