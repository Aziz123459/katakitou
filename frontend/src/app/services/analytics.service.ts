import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../environments/environment';

const SESSION_KEY = 'kokozito_analytics_ping';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private readonly http = inject(HttpClient);

  /** Une requête analytics par session navigateur. */
  pingOncePerSession(): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    if (sessionStorage.getItem(SESSION_KEY)) {
      return;
    }
    sessionStorage.setItem(SESSION_KEY, '1');
    const url = `${environment.apiBaseUrl}/api/analytics/ping/`;
    this.http.post(url, {}).subscribe({ error: () => undefined });
  }
}
