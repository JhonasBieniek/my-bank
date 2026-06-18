import { Routes } from '@angular/router';

export const myProductsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./my-products.component').then((m) => m.MyProductsComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./product-form.component').then((m) => m.ProductFormComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./product-form.component').then((m) => m.ProductFormComponent),
  },
];
