export const DEMO_PASSWORD = 'Demo@2026!';

export const ANA = {
  email: 'ana@demo.mybank.local',
  paymentKey: '11111111-1111-1111-1111-111111111111',
} as const;

export const BRUNO = {
  email: 'bruno@demo.mybank.local',
  paymentKey: '22222222-2222-2222-2222-222222222222',
} as const;

export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
export const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL ?? 'http://localhost:4200';

export const OPENING_BALANCE_CENTS = 30_000;
