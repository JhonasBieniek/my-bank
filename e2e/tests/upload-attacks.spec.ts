import { test, expect } from '@playwright/test';

import { ANA } from '../helpers/constants';
import { apiRequest, disposeSessionCache, getAuthenticatedContext } from '../helpers/api';
import { assertBalanceIntegrity, assertClientError, assertNoServerError } from '../helpers/assertions';

test.describe.configure({ mode: 'serial' });

test.describe('Atacante malicioso — upload malicioso', () => {
  test.afterAll(async () => {
    await disposeSessionCache();
  });

  test('rejeita arquivo não-imagem disfarçado de JPEG', async () => {
    const ana = await getAuthenticatedContext(ANA.email);
    const fakeImage = Buffer.from('NOT_A_REAL_IMAGE_FILE');

    const response = await apiRequest(ana, 'POST', '/store/products', {
      multipart: {
        name: 'Produto upload falso',
        price: '10,00',
        cashback_percent: '0',
        active: 'true',
        image: {
          name: 'foto.jpg',
          mimeType: 'image/jpeg',
          buffer: fakeImage,
        },
      },
    });
    const text = await response.text();
    assertClientError(response.status(), text);
    expect(response.status()).toBe(422);
    await assertBalanceIntegrity(ana);
  });

  test('rejeita upload SVG/XML', async () => {
    const ana = await getAuthenticatedContext(ANA.email);
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      'utf8'
    );

    const response = await apiRequest(ana, 'POST', '/store/products', {
      multipart: {
        name: 'Produto SVG',
        price: '10,00',
        cashback_percent: '0',
        active: 'true',
        image: {
          name: 'evil.svg',
          mimeType: 'image/svg+xml',
          buffer: svg,
        },
      },
    });
    const text = await response.text();
    assertClientError(response.status(), text);
    expect(response.status()).toBe(422);
    await assertBalanceIntegrity(ana);
  });

  test('rejeita filename com path traversal ou dupla extensão', async () => {
    const ana = await getAuthenticatedContext(ANA.email);
    const fakeImage = Buffer.from('NOT_A_REAL_IMAGE_FILE');

    const response = await apiRequest(ana, 'POST', '/store/products', {
      multipart: {
        name: 'Produto traversal',
        price: '10,00',
        cashback_percent: '0',
        active: 'true',
        image: {
          name: 'evil..shell.png',
          mimeType: 'image/png',
          buffer: fakeImage,
        },
      },
    });
    const text = await response.text();
    assertClientError(response.status(), text);
    expect(response.status()).toBe(422);
    await assertBalanceIntegrity(ana);
  });
});
