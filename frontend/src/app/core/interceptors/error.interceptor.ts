import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { ApiErrorBody } from '../models';

export function extractErrorMessage(error: HttpErrorResponse): string {
  const body = error.error as ApiErrorBody | string | null;

  if (!body) {
    return 'Ocorreu um erro inesperado.';
  }

  if (typeof body === 'string') {
    return body;
  }

  if (body.message) {
    return body.message;
  }

  if (body.error) {
    return body.error;
  }

  if (Array.isArray(body.errors)) {
    return body.errors.join(', ');
  }

  if (body.errors && typeof body.errors === 'object') {
    return Object.values(body.errors).flat().join(', ');
  }

  return 'Ocorreu um erro inesperado.';
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        const isSessionCheck = req.url.includes('/auth/me');

        if (!isSessionCheck) {
          auth.setUser(null);

          const isGuestRoute =
            router.url.startsWith('/login') || router.url.startsWith('/register');

          if (!isGuestRoute) {
            router.navigate(['/login']);
          }
        }
      }

      return throwError(() => error);
    })
  );
};
