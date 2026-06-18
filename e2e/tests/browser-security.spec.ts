import { test, expect } from '@playwright/test';

import { ANA, DEMO_PASSWORD, FRONTEND_BASE_URL } from '../helpers/constants';

const frontendUnavailable = process.env.E2E_FRONTEND_UNAVAILABLE === '1';

test.describe('Atacante malicioso — browser', () => {
  test.beforeEach(() => {
    test.skip(frontendUnavailable, `Frontend indisponível em ${FRONTEND_BASE_URL}`);
  });

  test('acesso a /dashboard sem login redireciona para login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain('/login');
  });

  test('payload XSS em nome de produto não executa script no DOM', async ({ page }) => {
    const xssPayload = '<img src=x onerror="window.__xssPwned=true">';

    await page.goto('/login');
    await page.getByLabel(/e-mail/i).fill(ANA.email);
    await page.getByLabel(/senha/i).fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    await page.goto('/my-products/new');
    await page.getByLabel(/nome/i).fill(xssPayload);
    await page.getByLabel(/preço/i).fill('7,50');
    await page.getByRole('button', { name: /criar produto/i }).click();

    await page.goto('/store');
    const executed = await page.evaluate(() => (window as unknown as { __xssPwned?: boolean }).__xssPwned);
    expect(executed).toBeFalsy();

    const html = await page.content();
    expect(html).not.toContain('onerror="window.__xssPwned=true"');
  });
});
