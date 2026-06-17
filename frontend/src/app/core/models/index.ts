export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  balance_cents: number;
  payment_key: string;
}

export interface LedgerEntry {
  id: number;
  kind: string;
  amount_cents: number;
  balance_after_cents: number;
  created_at: string;
}

export interface DashboardResponse {
  user: User;
  ledger_entries: LedgerEntry[];
}

export interface TransferPayload {
  payee_identifier: string;
  amount: string;
  idempotency_key: string;
}

export interface TransferResponse {
  transfer: {
    id: number;
    amount_cents: number;
    recipient_name: string;
  };
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ApiErrorBody {
  message?: string;
  error?: string;
  errors?: string[] | Record<string, string[]>;
}
