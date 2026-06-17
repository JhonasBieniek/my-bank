import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { LoginPayload, RegisterPayload, User } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly currentUser = signal<User | null>(null);

  private sessionChecked = false;

  readonly user = this.currentUser.asReadonly();

  register(payload: RegisterPayload): Observable<User> {
    return this.http
      .post<{ user: User }>('/auth/register', { user: payload })
      .pipe(
        map((response) => response.user),
        tap((user) => {
          this.currentUser.set(user);
          this.sessionChecked = true;
        })
      );
  }

  login(payload: LoginPayload): Observable<User> {
    return this.http.post<{ user: User }>('/auth/login', payload).pipe(
      map((response) => response.user),
      tap((user) => {
        this.currentUser.set(user);
        this.sessionChecked = true;
      })
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>('/auth/logout', {}).pipe(
      tap(() => {
        this.currentUser.set(null);
        this.sessionChecked = true;
      })
    );
  }

  ensureSession(): Observable<boolean> {
    if (this.currentUser()) {
      return of(true);
    }

    if (this.sessionChecked) {
      return of(false);
    }

    return this.http.get<{ user: User }>('/auth/me').pipe(
      tap((data) => {
        this.currentUser.set(data.user);
        this.sessionChecked = true;
      }),
      map(() => true),
      catchError(() => {
        this.currentUser.set(null);
        this.sessionChecked = true;
        return of(false);
      })
    );
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  setUser(user: User | null): void {
    this.currentUser.set(user);
    this.sessionChecked = true;
  }
}
