import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/services/auth.service';
import { extractErrorMessage } from '../../core/interceptors/error.interceptor';
import { OPENING_BALANCE_CENTS } from '../../shared/constants';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-card">
      <h1>Criar conta</h1>
      <p class="muted">
        Saldo inicial de {{ openingBalanceLabel }} após o cadastro.
      </p>

      @if (errorMessage) {
        <div class="alert">{{ errorMessage }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form">
        <div class="field">
          <label for="name">Nome completo</label>
          <input id="name" type="text" formControlName="name" />
        </div>
        <div class="field">
          <label for="email">E-mail</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" />
        </div>
        <div class="field">
          <label for="phone">Telefone</label>
          <input
            id="phone"
            type="tel"
            formControlName="phone"
            placeholder="(11) 99999-0000"
          />
        </div>
        <div class="field">
          <label for="password">Senha</label>
          <input
            id="password"
            type="password"
            formControlName="password"
            autocomplete="new-password"
          />
        </div>
        <div class="field">
          <label for="password_confirmation">Confirmar senha</label>
          <input
            id="password_confirmation"
            type="password"
            formControlName="password_confirmation"
            autocomplete="new-password"
          />
        </div>
        <button type="submit" class="btn btn-primary btn-block" [disabled]="form.invalid || loading">
          {{ loading ? 'Criando...' : 'Criar conta' }}
        </button>
      </form>

      <p class="auth-footer">
        Já tem conta? <a routerLink="/login">Entrar</a>
      </p>
    </section>
  `,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly openingBalanceLabel = (OPENING_BALANCE_CENTS / 100).toLocaleString(
    'pt-BR',
    { style: 'currency', currency: 'BRL' }
  );
  loading = false;
  errorMessage = '';

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', Validators.required],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    const values = this.form.getRawValue();
    if (values.password !== values.password_confirmation) {
      this.errorMessage = 'As senhas não conferem.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.auth.register(values).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage =
          error.status === 422
            ? extractErrorMessage(error)
            : 'Não foi possível criar a conta.';
      },
      complete: () => {
        this.loading = false;
      },
    });
  }
}
