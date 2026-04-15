import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { CartLine } from '@app/models/order-history.model';
import { environment } from '../../environments/environment';

export interface OrderSyncPayload {
  readonly customer_name: string;
  readonly phone: string;
  readonly location: string;
  readonly lines: readonly {
    readonly id: string;
    readonly label: string;
    readonly unitPrice: number;
    readonly qty: number;
    readonly imageUrl?: string;
  }[];
  readonly subtotal: number;
  readonly shipping: number;
  readonly total: number;
}

@Injectable({
  providedIn: 'root',
})
export class OrderApiService {
  private readonly http = inject(HttpClient);

  /** Aligné sur Django DecimalField(max_digits=12, decimal_places=3) — évite les rejets 400 (float JS). */
  private roundMoney3(value: number): number {
    return Number.parseFloat(value.toFixed(3));
  }

  syncOrder(payload: OrderSyncPayload): Observable<{ readonly ok: boolean; readonly id: number }> {
    const url = `${environment.apiBaseUrl}/api/orders/`;
    return this.http.post<{ readonly ok: boolean; readonly id: number }>(url, payload);
  }

  buildPayloadFromCart(
    lines: CartLine[],
    subtotal: number,
    shipping: number,
    total: number,
  ): OrderSyncPayload | null {
    if (lines.length === 0) {
      return null;
    }
    let profile: { name?: string; phone?: string; location?: string } = {};
    try {
      const raw = localStorage.getItem('kokozito_profile');
      if (raw) {
        profile = JSON.parse(raw) as typeof profile;
      }
    } catch {
      profile = {};
    }
    return {
      customer_name: profile.name ?? '—',
      phone: profile.phone ?? '—',
      location: profile.location ?? '—',
      lines: lines.map((l) => {
        const base = {
          id: l.id,
          label: l.label,
          unitPrice: this.roundMoney3(l.unitPrice),
          qty: l.qty,
        };
        if (l.imageUrl) {
          return { ...base, imageUrl: l.imageUrl };
        }
        return base;
      }),
      subtotal: this.roundMoney3(subtotal),
      shipping: this.roundMoney3(shipping),
      total: this.roundMoney3(total),
    };
  }
}
