import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { WalletService } from '../../core/services/wallet.service';
import { LedgerEntry } from '../../core/models';
import { FormatMoneyPipe } from '../../shared/pipes/format-money.pipe';
import { ledgerKindLabel } from '../../shared/constants/ledger-labels';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, FormatMoneyPipe, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly wallet = inject(WalletService);
  private readonly router = inject(Router);

  readonly user = signal(this.auth.user());
  readonly ledgerEntries = signal<LedgerEntry[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.wallet.getDashboard().subscribe({
      next: (data) => {
        this.user.set(data.user);
        this.auth.setUser(data.user);
        this.ledgerEntries.set(data.ledger_entries);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Não foi possível carregar o dashboard.');
        this.loading.set(false);
      },
    });
  }

  kindLabel(kind: string): string {
    return ledgerKindLabel(kind);
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
