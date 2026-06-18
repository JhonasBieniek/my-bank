import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { StoreService } from '../../core/services/store.service';
import { Product } from '../../core/models';
import { extractErrorMessage } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
})
export class ProductFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(StoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loading = true;
  saving = false;
  errorMessage = '';
  editingId: number | null = null;
  selectedImage: File | null = null;
  removeImage = false;
  currentImageUrl: string | null = null;
  imagePreviewUrl: string | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    price: ['', Validators.required],
    cashback_percent: [0, [Validators.min(0), Validators.max(100)]],
    active: [true],
  });

  get isEditMode(): boolean {
    return this.editingId !== null;
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Editar produto' : 'Novo produto';
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');

    if (idParam === null) {
      this.loading = false;
      return;
    }

    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      void this.router.navigate(['/my-products']);
      return;
    }

    this.editingId = id;
    this.loadProduct(id);
  }

  ngOnDestroy(): void {
    this.revokePreviewUrl();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.revokePreviewUrl();
    this.selectedImage = file;
    this.removeImage = false;

    if (file) {
      this.imagePreviewUrl = URL.createObjectURL(file);
    }
  }

  markImageForRemoval(): void {
    this.revokePreviewUrl();
    this.selectedImage = null;
    this.removeImage = true;
    this.currentImageUrl = null;
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    const formValue = this.form.getRawValue();
    const payload = {
      ...formValue,
      image: this.selectedImage,
      remove_image: this.removeImage,
    };

    const request$ =
      this.editingId === null
        ? this.store.createProduct(payload)
        : this.store.updateProduct(this.editingId, payload);

    request$.subscribe({
      next: () => {
        void this.router.navigate(['/my-products']);
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage =
          error.status === 422 || error.status === 403
            ? extractErrorMessage(error)
            : 'Não foi possível salvar o produto.';
      },
    });
  }

  private loadProduct(id: number): void {
    this.store.listMyProducts().subscribe({
      next: (response) => {
        const product = response.products.find((item) => item.id === id);

        if (!product) {
          void this.router.navigate(['/my-products']);
          return;
        }

        this.populateForm(product);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o produto.';
        this.loading = false;
      },
    });
  }

  private populateForm(product: Product): void {
    this.currentImageUrl = product.image_url;
    this.form.reset({
      name: product.name,
      description: product.description ?? '',
      price: this.formatPriceInput(product.price_cents),
      cashback_percent: product.cashback_percent,
      active: product.active ?? true,
    });
  }

  private formatPriceInput(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', ',');
  }

  private revokePreviewUrl(): void {
    if (this.imagePreviewUrl) {
      URL.revokeObjectURL(this.imagePreviewUrl);
      this.imagePreviewUrl = null;
    }
  }
}
