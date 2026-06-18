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

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  cashback_percent: number;
  seller_name?: string;
  active?: boolean;
}

export interface ProductsPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ProductsResponse {
  products: Product[];
  pagination?: ProductsPagination;
  treasury_balance_cents?: number;
}

export interface ProductFormPayload {
  name: string;
  description?: string;
  price: string;
  cashback_percent?: number;
  active?: boolean;
  image?: File | null;
  remove_image?: boolean;
}

export interface PurchasePayload {
  idempotency_key: string;
}

export interface PurchaseResponse {
  purchase: {
    id: number;
    amount_cents: number;
    fee_cents: number;
    cashback_cents: number;
    seller_net_cents: number;
    product_name: string | null;
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
