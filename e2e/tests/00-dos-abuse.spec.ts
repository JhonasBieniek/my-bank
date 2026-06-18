import { test, expect } from '@playwright/test';

import { ANA } from '../helpers/constants';
import {
  apiRequest,
  disposeSessionCache,
  getAuthenticatedContext,
  getBalance,
  randomUuid,
} from '../helpers/api';
import {
  assertBalanceIntegrity,
  assertBalancesUnchanged,
  assertClientError,
} from '../helpers/assertions';

test.describe.configure({ mode: 'serial' });

test.describe('Atacante malicioso — DoS e abuso', () => {
  test.afterAll(async () => {
    await disposeSessionCache();
  });

  test('rajada de transferências inválidas não corrompe saldos', async () => {
    const ana = await getAuthenticatedContext(ANA.email);
    const balanceBefore = await getBalance(ana);

    const burst = Array.from({ length: 20 }, () =>
      apiRequest(ana, 'POST', '/transfers', {
        data: {
          payee_identifier: '22222222-2222-2222-2222-222222222222',
          amount: '50.000,00',
          idempotency_key: randomUuid(),
        },
      })
    );

    const responses = await Promise.all(burst);
    for (const response of responses) {
      const text = await response.text();
      assertClientError(response.status(), text);
      expect(response.status()).toBe(422);
    }

    const balanceAfter = await getBalance(ana);
    await assertBalancesUnchanged(balanceBefore, balanceAfter);
    expect(balanceAfter).toBeGreaterThanOrEqual(0);
    await assertBalanceIntegrity(ana);
  });
});
