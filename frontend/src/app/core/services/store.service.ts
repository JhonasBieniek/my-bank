import { HttpClient } from '@angular/common/http';

import { Injectable, inject } from '@angular/core';

import { Observable } from 'rxjs';



import {

  Product,

  ProductFormPayload,

  ProductsResponse,

  PurchasePayload,

  PurchaseResponse,

} from '../models';



@Injectable({ providedIn: 'root' })

export class StoreService {

  private readonly http = inject(HttpClient);



  listProducts(page = 1, perPage = 16): Observable<ProductsResponse> {

    return this.http.get<ProductsResponse>('/store/products', {

      params: { page: String(page), per_page: String(perPage) },

    });

  }



  listMyProducts(): Observable<ProductsResponse> {

    return this.http.get<ProductsResponse>('/store/products/mine');

  }



  createProduct(payload: ProductFormPayload): Observable<{ product: Product }> {

    return this.http.post<{ product: Product }>('/store/products', this.toFormData(payload));

  }



  updateProduct(id: number, payload: Partial<ProductFormPayload>): Observable<{ product: Product }> {

    return this.http.put<{ product: Product }>(`/store/products/${id}`, this.toFormData(payload));

  }



  deleteProduct(id: number): Observable<void> {

    return this.http.delete<void>(`/store/products/${id}`);

  }



  purchaseProduct(id: number, payload: PurchasePayload): Observable<PurchaseResponse> {

    return this.http.post<PurchaseResponse>(`/store/products/${id}/purchase`, payload);

  }



  private toFormData(payload: Partial<ProductFormPayload>): FormData {

    const formData = new FormData();



    if (payload.name !== undefined) {

      formData.append('name', payload.name);

    }



    if (payload.description !== undefined) {

      formData.append('description', payload.description);

    }



    if (payload.price !== undefined) {

      formData.append('price', payload.price);

    }



    if (payload.cashback_percent !== undefined) {

      formData.append('cashback_percent', String(payload.cashback_percent));

    }



    if (payload.active !== undefined) {

      formData.append('active', String(payload.active));

    }



    if (payload.remove_image) {

      formData.append('remove_image', 'true');

    }



    if (payload.image) {

      formData.append('image', payload.image);

    }



    return formData;

  }

}

