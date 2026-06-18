import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { StoreService } from '../../core/services/store.service';
import { Product, ProductsPagination } from '../../core/models';
import { extractErrorMessage } from '../../core/interceptors/error.interceptor';
import { FormatMoneyPipe } from '../../shared/pipes/format-money.pipe';

const PRODUCTS_PER_PAGE = 16;

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [RouterLink, FormatMoneyPipe],
  templateUrl: './store.component.html',
  styleUrl: './store.component.scss',
})
export class StoreComponent implements OnInit {
  private readonly store = inject(StoreService);
  private readonly router = inject(Router);

  readonly perPage = PRODUCTS_PER_PAGE;

  products: Product[] = [];
  treasuryBalanceCents = 0;
  pagination: ProductsPagination = {
    page: 1,
    per_page: PRODUCTS_PER_PAGE,
    total: 0,
    total_pages: 0,
  };
  loading = true;
  errorMessage = '';
  purchasingId: number | null = null;
  successMessage = '';

  ngOnInit(): void {
    this.loadProducts(1);
  }

  loadProducts(page: number): void {
    this.loading = true;
    this.errorMessage = '';

    this.store.listProducts(page, this.perPage).subscribe({
      next: (response) => {
        this.products = response.products;
        this.treasuryBalanceCents = response.treasury_balance_cents ?? 0;
        this.pagination = response.pagination ?? {
          page,
          per_page: this.perPage,
          total: response.products.length,
          total_pages: response.products.length > 0 ? 1 : 0,
        };
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar a loja.';
        this.loading = false;
      },
    });
  }

  goToPage(page: number): void {
    if (
      this.loading ||
      page < 1 ||
      page > this.pagination.total_pages ||
      page === this.pagination.page
    ) {
      return;
    }

    this.loadProducts(page);
  }

  pageNumbers(): number[] {
    const total = this.pagination.total_pages;
    if (total <= 1) {
      return [];
    }

    const current = this.pagination.page;
    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    const adjustedStart = Math.max(1, end - 4);

    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }

  purchase(product: Product): void {
    if (this.purchasingId !== null) {
      return;
    }

    this.purchasingId = product.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.store
      .purchaseProduct(product.id, { idempotency_key: crypto.randomUUID() })
      .subscribe({
        next: (response) => {
          const cashback =
            response.purchase.cashback_cents > 0
              ? ` Cashback: ${(response.purchase.cashback_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
              : '';
          this.successMessage = `Compra de ${response.purchase.product_name ?? product.name} realizada com sucesso.${cashback}`;
          this.purchasingId = null;
          setTimeout(() => this.router.navigate(['/dashboard']), 1500);
        },
        error: (error: HttpErrorResponse) => {
          this.purchasingId = null;
          this.errorMessage =
            error.status === 422
              ? extractErrorMessage(error)
              : 'Não foi possível concluir a compra.';
        },
      });
  }
}
