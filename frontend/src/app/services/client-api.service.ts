import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

import type { CartLine } from '@app/models/order-history.model';
import { environment } from '../../environments/environment';

const STORAGE_CLIENT_TOKEN = 'kokozito_client_token';
const STORAGE_PROFILE = 'kokozito_profile';

export interface ClientProfileResponse {
  readonly name: string;
  readonly phone: string;
  readonly location: string;
  readonly role: string;
}

@Injectable({
  providedIn: 'root',
})
export class ClientApiService {
  private readonly http = inject(HttpClient);

  /**
   * POST /api/client/claim-token/ — jeton si le profil existe.
   * Avec `name` : vérifie que le prénom correspond (appareil déjà enregistré).
   * Sans `name` : accepte uniquement le numéro (reconnexion depuis la boutique).
   */
  claimToken(phone: string, name?: string): Observable<{ readonly access_token: string }> {
    return this.http.post<{ readonly access_token: string }>(
      `${environment.apiBaseUrl}/api/client/claim-token/`,
      { phone: phone.trim(), name: name?.trim() ?? '' },
    );
  }

  /**
   * Garantit la présence de `kokozito_client_token` si `kokozito_profile` existe (inscription ancienne).
   */
  ensureTokenFromProfile(): Observable<boolean> {
    if (typeof localStorage === 'undefined') {
      return of(false);
    }
    if (localStorage.getItem(STORAGE_CLIENT_TOKEN)) {
      return of(true);
    }
    const raw = localStorage.getItem(STORAGE_PROFILE);
    if (!raw) {
      return of(false);
    }
    try {
      const p = JSON.parse(raw) as { name?: string; phone?: string };
      if (!p.phone?.trim()) {
        return of(false);
      }
      return this.claimToken(p.phone.trim(), p.name?.trim() || '').pipe(
        tap((res) => localStorage.setItem(STORAGE_CLIENT_TOKEN, res.access_token)),
        map(() => true),
        catchError(() => of(false)),
      );
    } catch {
      return of(false);
    }
  }

  getProfile(): Observable<ClientProfileResponse> {
    return this.http.get<ClientProfileResponse>(
      `${environment.apiBaseUrl}/api/client/profile/`,
    );
  }

  getCart(): Observable<{ readonly lines: CartLine[] }> {
    return this.http.get<{ readonly lines: CartLine[] }>(
      `${environment.apiBaseUrl}/api/client/cart/`,
    );
  }

  putCart(lines: readonly CartLine[]): Observable<{ readonly ok: boolean }> {
    return this.http.put<{ readonly ok: boolean }>(
      `${environment.apiBaseUrl}/api/client/cart/`,
      { lines },
    );
  }
}
