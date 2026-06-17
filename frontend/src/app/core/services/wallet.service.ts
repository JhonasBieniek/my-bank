import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { DashboardResponse, TransferPayload, TransferResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);

  getDashboard(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>('/dashboard');
  }

  createTransfer(payload: TransferPayload): Observable<TransferResponse> {
    return this.http.post<TransferResponse>('/transfers', payload);
  }
}
