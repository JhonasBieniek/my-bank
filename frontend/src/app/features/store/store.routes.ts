import { Routes } from '@angular/router';

export const storeRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./store.component').then((m) => m.StoreComponent),
  },
  {
    path: 'my-products',
    redirectTo: '/my-products',
    pathMatch: 'full',
  },
];
