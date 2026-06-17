import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { WalletService } from '../../core/services/wallet.service';
import { extractErrorMessage } from '../../core/interceptors/error.interceptor';
import { FormatMoneyPipe } from '../../shared/pipes/format-money.pipe';

@Component({
  selector: 'app-transfer',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './transfer.component.html',
  styleUrl: './transfer.component.scss',
})
export class TransferComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly wallet = inject(WalletService);
  private readonly router = inject(Router);

  loading = false;
  submitted = false;
  errorMessage = '';
  successMessage = '';

  readonly form = this.fb.nonNullable.group({
    payee_identifier: ['', Validators.required],
    amount: ['', Validators.required],
    idempotency_key: ['', Validators.required],
  });

  ngOnInit(): void {
    this.form.patchValue({ idempotency_key: crypto.randomUUID() });
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitted) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.wallet.createTransfer(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.submitted = true;
        this.successMessage = `Transferência de ${this.formatCents(response.transfer.amount_cents)} para ${response.transfer.recipient_name} realizada com sucesso.`;
        setTimeout(() => this.router.navigate(['/dashboard']), 1500);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage =
          error.status === 422
            ? extractErrorMessage(error)
            : 'Não foi possível concluir a transferência.';
      },
      complete: () => {
        this.loading = false;
      },
    });
  }

  private formatCents(cents: number): string {
    return new FormatMoneyPipe().transform(cents);
  }
}
