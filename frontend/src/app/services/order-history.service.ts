import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, switchMap, of } from 'rxjs';

import type { OrderHistoryEntry } from '@app/models/order-history.model';
import { ClientApiService } from '@app/services/client-api.service';
import { environment } from '../../environments/environment';

const STORAGE_CLIENT_TOKEN = 'kokozito_client_token';

@Injectable({
  providedIn: 'root',
})
export class OrderHistoryService {
  private readonly http = inject(HttpClient);
  private readonly clientApi = inject(ClientApiService);
  private readonly entries = signal<OrderHistoryEntry[]>([]);

  readonly orders = computed(() => this.entries());

  /** Historique depuis la base : récupère un jeton si besoin (profil local sans token). */
  refreshFromServer(): void {
    if (typeof localStorage === 'undefined') {
      this.entries.set([]);
      return;
    }
    const url = `${environment.apiBaseUrl}/api/client/orders/`;
    this.clientApi
      .ensureTokenFromProfile()
      .pipe(
        switchMap((ok) => {
          if (!ok) {
            return of<OrderHistoryEntry[]>([]);
          }
          return this.http.get<OrderHistoryEntry[]>(url).pipe(
            catchError((err: HttpErrorResponse) => {
              if (err.status === 401) {
                localStorage.removeItem(STORAGE_CLIENT_TOKEN);
                return this.clientApi.ensureTokenFromProfile().pipe(
                  switchMap((ok2) =>
                    ok2 ? this.http.get<OrderHistoryEntry[]>(url) : of([]),
                  ),
                  catchError(() => of([])),
                );
              }
              return of([]);
            }),
          );
        }),
      )
      .subscribe({
        next: (rows) => {
          this.entries.set(rows.map((r) => this.normalizeEntry(r)));
        },
        error: () => {
          this.entries.set([]);
        },
      });
  }

  private normalizeEntry(r: OrderHistoryEntry): OrderHistoryEntry {
    return {
      ...r,
      lines: r.lines.map((l) => ({
        ...l,
        unitPrice: Number(l.unitPrice),
        qty: Number(l.qty),
      })),
      subtotal: Number(r.subtotal),
      shipping: Number(r.shipping),
      total: Number(r.total),
    };
  }
}
