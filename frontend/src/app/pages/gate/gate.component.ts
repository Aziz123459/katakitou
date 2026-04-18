import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AnalyticsService } from '@app/services/analytics.service';
import { environment } from '../../../environments/environment';

interface LoginResponse {
  readonly access: string;
  readonly refresh: string;
  readonly role: string;
  readonly user_id: number;
}

@Component({
  selector: 'app-gate',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './gate.component.html',
  styleUrl: './gate.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GatePageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly analytics = inject(AnalyticsService);

  readonly siteBrand = 'Kokozito';

  adminEmail = '';
  adminPassword = '';
  readonly adminError = signal<string | null>(null);
  readonly adminLoading = signal(false);

  ngOnInit(): void {
    this.analytics.pingOncePerSession();
  }

  loginAdmin(): void {
    this.adminError.set(null);
    const ident = this.adminEmail.trim();
    if (!ident || !this.adminPassword) {
      this.adminError.set('Renseignez l’e-mail (ou le nom d’utilisateur) et le mot de passe.');
      return;
    }
    const body =
      ident.includes('@')
        ? { email: ident, password: this.adminPassword }
        : { username: ident, password: this.adminPassword };
    this.adminLoading.set(true);
    this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/api/auth/login/`, body)
      .subscribe({
        next: (res) => {
          this.adminLoading.set(false);
          if (res.role !== 'admin') {
            this.adminError.set('Ce compte n’est pas administrateur.');
            return;
          }
          localStorage.setItem('kokozito_admin_token', res.access);
          localStorage.setItem('kokozito_admin_refresh', res.refresh);
          localStorage.setItem('kokozito_admin_role', res.role);
          localStorage.setItem('kokozito_admin_user_id', String(res.user_id));
          void this.router.navigate(['/admin']);
        },
        error: (err: HttpErrorResponse) => {
          this.adminLoading.set(false);
          if (err.status === 401) {
            this.adminError.set('E-mail / nom d’utilisateur ou mot de passe incorrect.');
          } else if (err.status === 0) {
            this.adminError.set(
              'Impossible de joindre l’API (réseau, CORS ou mauvaise URL). Vérifiez le déploiement du front et apiBaseUrl.',
            );
          } else {
            this.adminError.set('Identifiants incorrects ou serveur indisponible.');
          }
        },
      });
  }
}
