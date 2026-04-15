import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, switchMap, take } from 'rxjs';

import type { IRegisterResponse } from '@app/models/register.models';
import { ClientApiService } from '@app/services/client-api.service';
import { RegisterService } from '@app/services/register.service';

type IAccessStep = 'choose' | 'existing' | 'new';

@Component({
  selector: 'app-register-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register-modal.component.html',
  styleUrl: './register-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly registerService = inject(RegisterService);
  private readonly clientApi = inject(ClientApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly dismiss = output<void>();
  /** Émis après inscription ou reconnexion réussie (avant fermeture). */
  readonly accountCreated = output<void>();

  readonly accessStep = signal<IAccessStep>('choose');

  readonly modalTitle = computed(() => {
    switch (this.accessStep()) {
      case 'choose':
        return 'Continuer vers le panier';
      case 'existing':
        return 'Déjà client';
      case 'new':
        return 'Créer un compte';
    }
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    phone: ['', [Validators.required, Validators.maxLength(32)]],
    localization: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  readonly existingForm = this.fb.nonNullable.group({
    phone: ['', [Validators.required, Validators.maxLength(32)]],
  });

  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);

  ngOnInit(): void {
    this.accessStep.set('choose');
    this.form.reset({
      name: '',
      phone: '',
      localization: '',
    });
    this.existingForm.reset({ phone: '' });
    this.serverError.set(null);
    this.submitting.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dismiss.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.dismiss.emit();
    }
  }

  pickExisting(): void {
    this.serverError.set(null);
    this.accessStep.set('existing');
  }

  pickNew(): void {
    this.serverError.set(null);
    this.accessStep.set('new');
  }

  backToChoose(): void {
    this.serverError.set(null);
    this.accessStep.set('choose');
  }

  private setErrorFromHttp(err: unknown): void {
    const body = (err as { error?: unknown })?.error;
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
      const parts = Object.entries(body as Record<string, unknown>).flatMap(([k, v]) => {
        if (Array.isArray(v)) {
          return v.map((m) => `${k}: ${String(m)}`);
        }
        return [`${k}: ${String(v)}`];
      });
      this.serverError.set(parts.length > 0 ? parts.join(' — ') : 'Action impossible.');
    } else {
      this.serverError.set('Erreur réseau ou serveur indisponible.');
    }
    this.cdr.markForCheck();
  }

  submitExisting(): void {
    if (this.existingForm.invalid || this.submitting()) {
      this.existingForm.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);
    const phone = this.existingForm.controls.phone.value.trim();
    this.clientApi
      .claimToken(phone)
      .pipe(
        take(1),
        switchMap((res) => {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('kokozito_client_token', res.access_token);
          }
          return this.clientApi.getProfile();
        }),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: (prof) => {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(
              'kokozito_profile',
              JSON.stringify({
                name: prof.name,
                phone: prof.phone,
                location: prof.location,
              }),
            );
          }
          this.accountCreated.emit();
          this.dismiss.emit();
        },
        error: (err: unknown) => {
          this.setErrorFromHttp(err);
        },
      });
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);
    this.registerService
      .register(this.form.getRawValue())
      .pipe(
        take(1),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: (res: IRegisterResponse) => {
          const v = this.form.getRawValue();
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(
              'kokozito_profile',
              JSON.stringify({
                name: v.name,
                phone: v.phone,
                location: v.localization,
              }),
            );
            if (res.access_token) {
              localStorage.setItem('kokozito_client_token', res.access_token);
            }
          }
          this.accountCreated.emit();
          this.dismiss.emit();
        },
        error: (err: unknown) => {
          this.setErrorFromHttp(err);
        },
      });
  }

  close(): void {
    this.dismiss.emit();
  }
}
