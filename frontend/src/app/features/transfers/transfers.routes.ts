import { Routes } from '@angular/router';

export const transferRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./transfer.component').then((m) => m.TransferComponent),
  },
];
