import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';

import type { CartLine, OrderHistoryEntry } from '@app/models/order-history.model';
import { hasAdminSession } from '@app/auth/admin.guard';
import { AnalyticsService } from '@app/services/analytics.service';
import { formatTndDisplay } from '@app/format-tnd-display';
import { OrderHistoryService } from '@app/services/order-history.service';
import { landingImage } from '../landing/landing-assets';

@Component({
  selector: 'app-order-history-page',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './order-history-page.component.html',
  styleUrl: './order-history-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderHistoryPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly historyService = inject(OrderHistoryService);
  private readonly analytics = inject(AnalyticsService);

  private thanksHideTimer: ReturnType<typeof setTimeout> | null = null;

  readonly logoSrc = '/media/logo-katakitou.jpg';
  readonly siteBrand = 'Katakitou';

  readonly bagThumb = landingImage('gallery1');
  readonly towelThumb = landingImage('towelMain');
  readonly packDuoThumb = landingImage('packDuoBain');

  readonly orders = this.historyService.orders;

  /** Bandeau de remerciement après validation du panier (query ?merci=1) */
  readonly thanksVisible = signal(false);

  readonly hasAdminDashboard = signal(hasAdminSession());

  ngOnInit(): void {
    this.analytics.pingOncePerSession();
    this.hasAdminDashboard.set(hasAdminSession());
    this.historyService.refreshFromServer();
    if (this.route.snapshot.queryParamMap.get('merci') === '1') {
      this.thanksVisible.set(true);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
      this.thanksHideTimer = setTimeout(() => {
        this.thanksVisible.set(false);
        this.thanksHideTimer = null;
      }, 3800);
    }

    this.destroyRef.onDestroy(() => {
      if (this.thanksHideTimer !== null) {
        clearTimeout(this.thanksHideTimer);
      }
    });
  }

  productImage(line: CartLine): string {
    if (line.imageUrl) {
      return line.imageUrl;
    }
    if (line.id === 'bag') {
      return this.bagThumb;
    }
    if (line.id === 'towel') {
      return this.towelThumb;
    }
    if (line.id === 'pack-duo-bain') {
      return this.packDuoThumb;
    }
    return this.bagThumb;
  }

  formatOrderDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  formatMoney(value: number): string {
    return formatTndDisplay(value);
  }

  dismissThanks(): void {
    if (this.thanksHideTimer !== null) {
      clearTimeout(this.thanksHideTimer);
      this.thanksHideTimer = null;
    }
    this.thanksVisible.set(false);
  }

  trackOrder(_i: number, o: OrderHistoryEntry): string {
    return o.id;
  }
}
