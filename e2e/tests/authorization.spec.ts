import { test, expect } from '@playwright/test';

import { ANA, BRUNO } from '../helpers/constants';
import {
  apiRequest,
  disposeSessionCache,
  getAuthenticatedContext,
  newApiContext,
} from '../helpers/api';
import { assertClientError, assertNoServerError } from '../helpers/assertions';

test.describe.configure({ mode: 'serial' });

test.describe('Atacante malicioso — autorização', () => {
  test.afterAll(async () => {
    await disposeSessionCache();
  });

  test('GET /dashboard sem login retorna 401', async () => {
    const guest = await newApiContext();
    const response = await guest.get('/dashboard');
    const text = await response.text();
    assertClientError(response.status(), text);
    expect(response.status()).toBe(401);
    await guest.dispose();
  });

  test('GET /store/products/mine sem autenticação retorna 401', async () => {
    const guest = await newApiContext();
    const response = await guest.get('/store/products/mine');
    const text = await response.text();
    assertClientError(response.status(), text);
    expect(response.status()).toBe(401);
    await guest.dispose();
  });

  test('não permite editar produto de outro vendedor', async () => {
    const ana = await getAuthenticatedContext(ANA.email);
    const bruno = await getAuthenticatedContext(BRUNO.email);

    const mine = await bruno.get('/store/products/mine');
    expect(mine.ok()).toBeTruthy();
    const body = (await mine.json()) as { products: Array<{ id: number; name: string }> };
    const brunoProduct = body.products[0];
    expect(brunoProduct).toBeTruthy();

    const attack = await apiRequest(ana, 'PUT', `/store/products/${brunoProduct.id}`, {
      multipart: {
        name: 'Produto sequestrado',
        price: '1,00',
        cashback_percent: '0',
        active: 'true',
      },
    });
    const text = await attack.text();
    assertClientError(attack.status(), text);
    expect(attack.status()).toBe(403);
  });

  test('não permite excluir produto de outro vendedor', async () => {
    const ana = await getAuthenticatedContext(ANA.email);
    const bruno = await getAuthenticatedContext(BRUNO.email);

    const mine = await bruno.get('/store/products/mine');
    const body = (await mine.json()) as { products: Array<{ id: number }> };
    const brunoProduct = body.products[0];
    expect(brunoProduct).toBeTruthy();

    const attack = await apiRequest(ana, 'DELETE', `/store/products/${brunoProduct.id}`);
    const text = await attack.text();
    assertClientError(attack.status(), text);
    expect(attack.status()).toBe(403);
  });

  test('sessão de um usuário não expõe dados de outro via /dashboard', async () => {
    const ana = await getAuthenticatedContext(ANA.email);
    const bruno = await getAuthenticatedContext(BRUNO.email);

    const anaDashboard = await ana.get('/dashboard');
    const brunoDashboard = await bruno.get('/dashboard');

    expect(anaDashboard.ok()).toBeTruthy();
    expect(brunoDashboard.ok()).toBeTruthy();

    const anaBody = (await anaDashboard.json()) as { user: { email: string } };
    const brunoBody = (await brunoDashboard.json()) as { user: { email: string } };

    expect(anaBody.user.email).toBe(ANA.email);
    expect(brunoBody.user.email).toBe(BRUNO.email);
    expect(anaBody.user.email).not.toBe(brunoBody.user.email);
  });

  test('POST /transfers sem sessão retorna 401', async () => {
    const guest = await newApiContext();
    const response = await guest.post('/transfers', {
      data: {
        payee_identifier: BRUNO.paymentKey,
        amount: '1,00',
      },
    });
    const text = await response.text();
    assertClientError(response.status(), text);
    expect(response.status()).toBe(401);
    await guest.dispose();
  });
});
