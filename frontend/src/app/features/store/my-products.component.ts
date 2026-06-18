import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { StoreService } from '../../core/services/store.service';
import { Product } from '../../core/models';
import { extractErrorMessage } from '../../core/interceptors/error.interceptor';
import { FormatMoneyPipe } from '../../shared/pipes/format-money.pipe';

@Component({
  selector: 'app-my-products',
  standalone: true,
  imports: [RouterLink, FormatMoneyPipe],
  templateUrl: './my-products.component.html',
  styleUrl: './my-products.component.scss',
})
export class MyProductsComponent implements OnInit {
  private readonly store = inject(StoreService);

  products: Product[] = [];
  loading = true;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.errorMessage = '';

    this.store.listMyProducts().subscribe({
      next: (response) => {
        this.products = response.products;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar seus produtos.';
        this.loading = false;
      },
    });
  }

  deleteProduct(product: Product): void {
    if (!confirm(`Remover o produto "${product.name}"?`)) {
      return;
    }

    this.store.deleteProduct(product.id).subscribe({
      next: () => {
        this.successMessage = 'Produto removido.';
        this.loadProducts();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage =
          error.status === 422 || error.status === 403
            ? extractErrorMessage(error)
            : 'Não foi possível remover o produto.';
      },
    });
  }
}
