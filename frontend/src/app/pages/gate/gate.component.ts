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
import { messageForHttpError } from '@app/shared/http-error-message';
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

  readonly siteBrand = 'Katakitou';

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
    if (!ident) {
      this.adminError.set('Indiquez votre e-mail ou votre nom d’utilisateur.');
      return;
    }
    if (!this.adminPassword) {
      this.adminError.set('Indiquez votre mot de passe.');
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
            this.adminError.set(
              'Ce compte n’a pas le rôle administrateur. Utilisez un compte autorisé pour le tableau de bord.',
            );
            return;
          }
          localStorage.setItem('katakitou_admin_token', res.access);
          localStorage.setItem('katakitou_admin_refresh', res.refresh);
          localStorage.setItem('katakitou_admin_role', res.role);
          localStorage.setItem('katakitou_admin_user_id', String(res.user_id));
          void this.router.navigate(['/admin']);
        },
        error: (err: HttpErrorResponse) => {
          this.adminLoading.set(false);
          this.adminError.set(
            messageForHttpError(err, {
              unauthorizedFallback:
                'Connexion refusée : e-mail ou nom d’utilisateur ou mot de passe incorrect.',
              invalidPayloadFallback:
                'Les informations envoyées ne sont pas valides. Vérifiez l’e-mail ou le nom d’utilisateur et le mot de passe.',
            }),
          );
        },
      });
  }

  clearAdminError(): void {
    this.adminError.set(null);
  }
}
