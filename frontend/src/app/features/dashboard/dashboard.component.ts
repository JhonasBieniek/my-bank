import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <section class="hero-card">
      <p class="eyebrow">Bem-vindo</p>
      <h1>Logado como {{ user()?.email }}</h1>
      <p class="muted">
        Em breve: extrato, saldo e movimentações da sua conta.
      </p>
      <button type="button" class="btn btn-primary" (click)="logout()">
        Sair
      </button>
    </section>
  `,
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
