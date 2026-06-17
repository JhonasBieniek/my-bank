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
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
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
