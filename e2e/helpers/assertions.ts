import { expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

import { getDashboardSnapshot } from './api';

export function assertClientError(status: number, bodyText: string): void {
  expect(status).toBeGreaterThanOrEqual(400);
  expect(status).toBeLessThan(500);
  expect(bodyText).not.toMatch(/at\s+\w+\s*\(/);
  expect(bodyText).not.toMatch(/\.js:\d+:\d+/);
}

export function assertNoServerError(status: number, bodyText: string): void {
  expect(status).toBeLessThan(500);
  expect(bodyText).not.toMatch(/at\s+\w+\s*\(/);
}

export async function assertBalanceIntegrity(ctx: APIRequestContext): Promise<void> {
  const snapshot = await getDashboardSnapshot(ctx);
  expect(snapshot.balanceCents).toBeGreaterThanOrEqual(0);

  if (snapshot.ledgerTopBalanceAfter !== null) {
    expect(snapshot.ledgerTopBalanceAfter).toBe(snapshot.balanceCents);
  }
}

export async function assertBalancesUnchanged(
  before: number,
  after: number,
  toleranceCents = 0
): Promise<void> {
  expect(Math.abs(after - before)).toBeLessThanOrEqual(toleranceCents);
}
