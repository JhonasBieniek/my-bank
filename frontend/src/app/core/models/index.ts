export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  balance_cents: number;
  payment_key: string;
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
