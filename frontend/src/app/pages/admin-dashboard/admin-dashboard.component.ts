import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { environment } from '../../../environments/environment';
import { formatTndDisplay } from '@app/format-tnd-display';

export interface AdminOrderRow {
  readonly id: number;
  readonly customer_name: string;
  readonly phone: string;
  readonly location: string;
  readonly lines: readonly {
    readonly id: string;
    readonly label: string;
    readonly unitPrice: number | string;
    readonly qty: number;
  }[];
  readonly subtotal: string;
  readonly shipping: string;
  readonly total: string;
  readonly created_at: string;
}

export interface AdminAccountRow {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly location: string;
  readonly role: string;
  readonly created_at: string;
  readonly is_superuser?: boolean;
}

export interface AdminStats {
  readonly visitors_today: number;
  readonly visitors_month: number;
  readonly visitors_year: number;
  readonly visitors_total: number;
  readonly orders_today: number;
  readonly orders_month: number;
  readonly orders_year: number;
  readonly orders_total: number;
  readonly revenue_today: string;
  readonly revenue_month: string;
  readonly revenue_year: string;
  readonly revenue_total: string;
  readonly visitors_month_delta_pct?: number | null;
  readonly orders_month_delta_pct?: number | null;
  readonly revenue_month_delta_pct?: number | null;
  readonly conversion_month_pct?: number;
  readonly conversion_month_delta_pp?: number;
}

export interface AdminInventoryRow {
  readonly product_key: string;
  readonly label: string;
  readonly quantity: number;
}

export interface AdminShopProductRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly highlights?: string;
  readonly price: string;
  readonly image_url: string;
  readonly image_urls?: readonly string[];
}

/** Fichier galerie en attente + URL objet pour aperçu (révoquée à la suppression). */
export interface AdminPendingGalleryImage {
  readonly id: string;
  readonly file: File;
  readonly objectUrl: string;
}

export interface AdminProductMixRow {
  readonly product_key: string;
  readonly label: string;
  readonly qty: number;
  readonly pct: number;
}

export interface SeriesPoint {
  readonly label: string;
  readonly value: number;
}

export type SeriesGranularity = 'day' | 'month' | 'year';

export type KpiGranularity = 'day' | 'month' | 'year';

interface AnalyticsSeriesResponse {
  readonly granularity: SeriesGranularity;
  readonly visits: SeriesPoint[];
  readonly orders: SeriesPoint[];
  readonly revenue: SeriesPoint[];
}

interface DashboardResponse {
  readonly orders: AdminOrderRow[];
  readonly accounts: AdminAccountRow[];
  readonly stats: AdminStats;
  readonly inventory?: AdminInventoryRow[];
  readonly shop_products?: readonly AdminShopProductRow[];
  readonly product_mix?: AdminProductMixRow[];
}

export type AdminSectionId = 'overview' | 'kpis' | 'stock' | 'products' | 'orders' | 'accounts';

const PIE_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f472b6', '#eab308', '#6366f1'] as const;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /** Menu latéral ouvert (≤ tablette). */
  readonly navOpen = signal(false);

  readonly orders = signal<AdminOrderRow[]>([]);
  readonly accounts = signal<AdminAccountRow[]>([]);
  readonly stats = signal<AdminStats | null>(null);
  readonly productMix = signal<AdminProductMixRow[]>([]);
  readonly inventory = signal<AdminInventoryRow[]>([]);
  /** Brouillon des quantités (clé = product_key). */
  readonly inventoryDraft = signal<Record<string, number>>({});
  readonly inventorySaving = signal(false);
  readonly inventorySaveError = signal<string | null>(null);
  readonly shopProducts = signal<AdminShopProductRow[]>([]);
  readonly newProductName = signal('');
  readonly newProductDescription = signal('');
  readonly newProductHighlights = signal('');
  readonly newProductPrice = signal('');
  readonly newProductImageFile = signal<File | null>(null);
  /** Aperçu image principale (`createObjectURL`). */
  readonly newProductPrimaryPreviewUrl = signal<string | null>(null);
  readonly newProductGalleryPicks = signal<readonly AdminPendingGalleryImage[]>([]);
  readonly productFormError = signal<string | null>(null);
  readonly productSaving = signal(false);
  /** Réf. `sp-…` du produit boutique en cours de suppression. */
  readonly productDeletingId = signal<string | null>(null);
  readonly accountsError = signal<string | null>(null);
  readonly accountActionPendingId = signal<number | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly loading = signal(true);

  readonly seriesGranularity = signal<SeriesGranularity>('month');
  readonly seriesLoading = signal(false);
  readonly seriesVisits = signal<SeriesPoint[]>([]);

  /** Période affichée dans la section Indicateurs (défaut : mois). */
  readonly kpiGranularity = signal<KpiGranularity>('month');

  readonly kpiPeriodLabel = computed(() => {
    switch (this.kpiGranularity()) {
      case 'day':
        return 'Aujourd’hui';
      case 'month':
        return 'Ce mois';
      case 'year':
        return 'Cette année';
    }
  });

  readonly kpiVisitorsValue = computed(() => {
    const s = this.stats();
    if (!s) {
      return '—';
    }
    switch (this.kpiGranularity()) {
      case 'day':
        return String(s.visitors_today);
      case 'month':
        return String(s.visitors_month);
      case 'year':
        return String(s.visitors_year);
    }
  });

  readonly kpiOrdersValue = computed(() => {
    const s = this.stats();
    if (!s) {
      return '—';
    }
    switch (this.kpiGranularity()) {
      case 'day':
        return String(s.orders_today);
      case 'month':
        return String(s.orders_month);
      case 'year':
        return String(s.orders_year);
    }
  });

  readonly kpiRevenueRaw = computed(() => {
    const s = this.stats();
    if (!s) {
      return '';
    }
    switch (this.kpiGranularity()) {
      case 'day':
        return s.revenue_today;
      case 'month':
        return s.revenue_month;
      case 'year':
        return s.revenue_year;
    }
  });

  readonly lineChartPoints = computed(() => {
    const pts = this.seriesVisits();
    if (pts.length === 0) {
      return '';
    }
    const max = Math.max(...pts.map((p) => p.value), 1);
    const n = pts.length;
    const xPad = 2;
    const yPad = 4;
    const h = 40 - yPad * 2;
    const w = 100 - xPad * 2;
    return pts
      .map((p, i) => {
        const x = xPad + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
        const y = yPad + h - (p.value / max) * h;
        return `${x},${y}`;
      })
      .join(' ');
  });

  readonly areaChartPoints = computed(() => {
    const line = this.lineChartPoints();
    if (!line) {
      return '';
    }
    const coords = line.split(' ');
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (!first || !last) {
      return '';
    }
    const firstX = first.split(',')[0];
    const lastX = last.split(',')[0];
    return `${firstX},38 ${line} ${lastX},38`;
  });

  readonly pieGradient = computed(() => {
    const mix = this.productMix();
    if (mix.length === 0) {
      return 'conic-gradient(#e2e8f0 0% 100%)';
    }
    let acc = 0;
    const segs = mix.map((m, i) => {
      const start = acc;
      acc += m.pct;
      return `${PIE_COLORS[i % PIE_COLORS.length]} ${start}% ${acc}%`;
    });
    return `conic-gradient(${segs.join(', ')})`;
  });

  pieColorAt(index: number): string {
    return PIE_COLORS[index % PIE_COLORS.length];
  }

  /** Une seule section affichée à la fois (pas de page interminable). */
  readonly activeSection = signal<AdminSectionId>('overview');

  readonly sectionHeading = computed(() => {
    switch (this.activeSection()) {
      case 'overview':
        return 'Vue d’ensemble';
      case 'kpis':
        return 'Indicateurs détaillés';
      case 'stock':
        return 'Stock produits';
      case 'products':
        return 'Produits boutique';
      case 'orders':
        return 'Commandes';
      case 'accounts':
        return 'Comptes';
    }
  });

  @HostListener('window:resize')
  onWindowResize(): void {
    if (typeof window !== 'undefined' && window.innerWidth > 900 && this.navOpen()) {
      this.navOpen.set(false);
      this.syncBodyScrollLock(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.navOpen()) {
      this.closeNav();
    }
  }

  ngOnInit(): void {
    this.http.get<DashboardResponse>(`${environment.apiBaseUrl}/api/admin/dashboard/`).subscribe({
      next: (res) => {
        this.applyDashboardPayload(res);
        this.loading.set(false);
        this.loadError.set(null);
        this.fetchSeries();
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Impossible de charger les données (session expirée ou erreur serveur).');
      },
    });
  }

  private applyDashboardPayload(res: DashboardResponse): void {
    this.orders.set(res.orders);
    this.accounts.set(res.accounts ?? []);
    this.stats.set(res.stats);
    this.productMix.set(res.product_mix ?? []);
    const inv = res.inventory ?? [];
    this.inventory.set(inv);
    this.seedInventoryDraft(inv);
    this.inventorySaveError.set(null);
    this.shopProducts.set([...(res.shop_products ?? [])]);
  }

  private refetchDashboardData(): void {
    this.http.get<DashboardResponse>(`${environment.apiBaseUrl}/api/admin/dashboard/`).subscribe({
      next: (res) => {
        this.applyDashboardPayload(res);
      },
      error: () => undefined,
    });
  }

  onNewProductImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const prevUrl = this.newProductPrimaryPreviewUrl();
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
    }
    this.newProductImageFile.set(file);
    this.newProductPrimaryPreviewUrl.set(
      file && typeof URL !== 'undefined' ? URL.createObjectURL(file) : null,
    );
  }

  removePrimaryImage(): void {
    const prevUrl = this.newProductPrimaryPreviewUrl();
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
    }
    this.newProductPrimaryPreviewUrl.set(null);
    this.newProductImageFile.set(null);
    if (typeof document !== 'undefined') {
      const el = document.getElementById('admin-new-product-image') as HTMLInputElement | null;
      if (el) {
        el.value = '';
      }
    }
  }

  onNewProductGalleryChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const list = input.files;
    if (!list || list.length === 0 || typeof URL === 'undefined') {
      return;
    }
    const added: AdminPendingGalleryImage[] = Array.from(list).map((file) => ({
      id: this.newPendingImageId(),
      file,
      objectUrl: URL.createObjectURL(file),
    }));
    this.newProductGalleryPicks.update((prev) => [...prev, ...added]);
    input.value = '';
  }

  removeGalleryPick(id: string): void {
    this.newProductGalleryPicks.update((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) {
        URL.revokeObjectURL(found.objectUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }

  clearGallerySelection(): void {
    for (const p of this.newProductGalleryPicks()) {
      URL.revokeObjectURL(p.objectUrl);
    }
    this.newProductGalleryPicks.set([]);
    if (typeof document !== 'undefined') {
      const gal = document.getElementById(
        'admin-new-product-gallery',
      ) as HTMLInputElement | null;
      if (gal) {
        gal.value = '';
      }
    }
  }

  resetProductForm(): void {
    this.newProductName.set('');
    this.newProductDescription.set('');
    this.newProductHighlights.set('');
    this.newProductPrice.set('');
    this.revokePrimaryPreview();
    this.newProductImageFile.set(null);
    this.clearGallerySelection();
    this.productFormError.set(null);
    if (typeof document !== 'undefined') {
      const el = document.getElementById('admin-new-product-image') as HTMLInputElement | null;
      if (el) {
        el.value = '';
      }
      const gal = document.getElementById(
        'admin-new-product-gallery',
      ) as HTMLInputElement | null;
      if (gal) {
        gal.value = '';
      }
    }
  }

  submitNewShopProduct(): void {
    const name = this.newProductName().trim();
    const description = this.newProductDescription().trim();
    const highlights = this.newProductHighlights().trim();
    const priceRaw = this.newProductPrice().trim();
    const image = this.newProductImageFile();
    const galleryPicks = this.newProductGalleryPicks();
    if (!name) {
      this.productFormError.set('Indiquez un nom de produit.');
      return;
    }
    if (!description) {
      this.productFormError.set('Indiquez une description.');
      return;
    }
    if (!priceRaw) {
      this.productFormError.set('Indiquez un prix.');
      return;
    }
    if (!image) {
      this.productFormError.set('Choisissez une image (fichier).');
      return;
    }
    this.productFormError.set(null);
    this.productSaving.set(true);
    const body = new FormData();
    body.append('name', name);
    body.append('description', description);
    body.append('highlights', highlights);
    body.append('price', priceRaw.replace(',', '.'));
    body.append('image', image, image.name);
    for (const pick of galleryPicks) {
      body.append('gallery', pick.file, pick.file.name);
    }
    this.http
      .post<{ readonly ok: boolean }>(`${environment.apiBaseUrl}/api/admin/shop-products/`, body)
      .subscribe({
        next: () => {
          this.productSaving.set(false);
          this.resetProductForm();
          this.refetchDashboardData();
        },
        error: (err: HttpErrorResponse) => {
          this.productSaving.set(false);
          this.productFormError.set(this.apiErrorDetail(err));
        },
      });
  }

  deleteShopProduct(p: AdminShopProductRow): void {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `Supprimer « ${p.name} » ? Cette action est définitive (fichier image et stock associés).`,
      )
    ) {
      return;
    }
    this.productDeletingId.set(p.id);
    this.productFormError.set(null);
    const url = `${environment.apiBaseUrl}/api/admin/shop-products/${encodeURIComponent(p.id)}/`;
    this.http.delete(url).subscribe({
      next: () => {
        this.productDeletingId.set(null);
        this.refetchDashboardData();
      },
      error: (err: HttpErrorResponse) => {
        this.productDeletingId.set(null);
        this.productFormError.set(this.apiErrorDetail(err));
      },
    });
  }

  ngOnDestroy(): void {
    this.revokePrimaryPreview();
    this.clearGallerySelection();
    this.syncBodyScrollLock(false);
  }

  private revokePrimaryPreview(): void {
    const prevUrl = this.newProductPrimaryPreviewUrl();
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
    }
    this.newProductPrimaryPreviewUrl.set(null);
  }

  private newPendingImageId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  toggleNav(): void {
    const next = !this.navOpen();
    this.navOpen.set(next);
    this.syncBodyScrollLock(next);
  }

  closeNav(): void {
    if (!this.navOpen()) {
      return;
    }
    this.navOpen.set(false);
    this.syncBodyScrollLock(false);
  }

  private syncBodyScrollLock(lock: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  showSection(id: AdminSectionId): void {
    this.activeSection.set(id);
    this.closeNav();
  }

  setSeriesGranularity(g: SeriesGranularity): void {
    if (this.seriesGranularity() === g) {
      return;
    }
    this.seriesGranularity.set(g);
    this.fetchSeries();
  }

  setKpiGranularity(g: KpiGranularity): void {
    this.kpiGranularity.set(g);
  }

  private fetchSeries(): void {
    const g = this.seriesGranularity();
    this.seriesLoading.set(true);
    this.http
      .get<AnalyticsSeriesResponse>(`${environment.apiBaseUrl}/api/admin/analytics/series/?granularity=${g}`)
      .subscribe({
        next: (res) => {
          this.seriesVisits.set(res.visits);
          this.seriesLoading.set(false);
        },
        error: () => {
          this.seriesVisits.set([]);
          this.seriesLoading.set(false);
        },
      });
  }

  private seedInventoryDraft(rows: AdminInventoryRow[]): void {
    this.inventoryDraft.set(Object.fromEntries(rows.map((r) => [r.product_key, r.quantity])));
  }

  onInventoryQtyInput(productKey: string, raw: string): void {
    const n = Number.parseInt(raw, 10);
    const v = Number.isNaN(n) || n < 0 ? 0 : n;
    this.inventoryDraft.update((d) => ({ ...d, [productKey]: v }));
  }

  inventoryQtyFor(productKey: string): number {
    const d = this.inventoryDraft();
    if (productKey in d) {
      return d[productKey] ?? 0;
    }
    return this.inventory().find((r) => r.product_key === productKey)?.quantity ?? 0;
  }

  private currentAdminUserId(): number {
    if (typeof localStorage === 'undefined') {
      return -1;
    }
    const raw = localStorage.getItem('kokozito_admin_user_id');
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isNaN(n) ? -1 : n;
  }

  isCurrentAdminUser(row: AdminAccountRow): boolean {
    return row.id === this.currentAdminUserId();
  }

  canEditAccountRole(row: AdminAccountRow): boolean {
    if (row.is_superuser === true) {
      return false;
    }
    return row.id !== this.currentAdminUserId();
  }

  canDeleteAccount(row: AdminAccountRow): boolean {
    if (row.is_superuser === true) {
      return false;
    }
    return row.id !== this.currentAdminUserId();
  }

  onAccountRoleChange(row: AdminAccountRow, newRole: string): void {
    if (newRole === row.role || !this.canEditAccountRole(row)) {
      return;
    }
    this.accountActionPendingId.set(row.id);
    this.accountsError.set(null);
    this.http
      .patch<{ readonly account: AdminAccountRow }>(`${environment.apiBaseUrl}/api/admin/accounts/${row.id}/`, {
        role: newRole,
      })
      .subscribe({
        next: (res) => {
          this.accounts.update((rows) => rows.map((r) => (r.id === res.account.id ? res.account : r)));
          this.accountActionPendingId.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.accountActionPendingId.set(null);
          this.accountsError.set(this.apiErrorDetail(err));
        },
      });
  }

  deleteAccount(row: AdminAccountRow): void {
    if (!this.canDeleteAccount(row)) {
      return;
    }
    const ok = window.confirm(
      `Supprimer définitivement le compte de « ${row.name} » ? Cette action ne peut pas être annulée.`,
    );
    if (!ok) {
      return;
    }
    this.accountActionPendingId.set(row.id);
    this.accountsError.set(null);
    this.http.delete(`${environment.apiBaseUrl}/api/admin/accounts/${row.id}/`, { observe: 'response' }).subscribe({
      next: (res) => {
        if (res.status === 204) {
          this.accounts.update((rows) => rows.filter((r) => r.id !== row.id));
        }
        this.accountActionPendingId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.accountActionPendingId.set(null);
        this.accountsError.set(this.apiErrorDetail(err));
      },
    });
  }

  private apiErrorDetail(err: HttpErrorResponse): string {
    const body = err.error;
    if (body && typeof body === 'object' && 'detail' in body) {
      const d = (body as { detail?: unknown }).detail;
      if (typeof d === 'string') {
        return d;
      }
    }
    return 'Action impossible. Réessayez.';
  }

  saveInventory(): void {
    const rows = this.inventory();
    if (rows.length === 0) {
      return;
    }
    this.inventorySaving.set(true);
    this.inventorySaveError.set(null);
    const draft = this.inventoryDraft();
    const items = rows.map((r) => ({
      product_key: r.product_key,
      quantity: draft[r.product_key] ?? r.quantity,
    }));
    this.http
      .patch<{ readonly inventory: AdminInventoryRow[] }>(`${environment.apiBaseUrl}/api/admin/inventory/`, { items })
      .subscribe({
        next: (res) => {
          this.inventory.set(res.inventory);
          this.seedInventoryDraft(res.inventory);
          this.inventorySaving.set(false);
        },
        error: () => {
          this.inventorySaving.set(false);
          this.inventorySaveError.set('Enregistrement impossible. Réessayez.');
        },
      });
  }

  formatDeltaPct(delta: number | null | undefined): string {
    if (delta == null) {
      return '— vs mois précédent';
    }
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % vs mois précédent`;
  }

  formatDeltaPp(delta: number | null | undefined): string {
    if (delta == null) {
      return '— vs mois précédent';
    }
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} pt vs mois précédent`;
  }

  trendClass(delta: number | null | undefined): string {
    if (delta == null) {
      return 'overview-kpi__trend--neutral';
    }
    if (delta > 0) {
      return 'overview-kpi__trend--up';
    }
    if (delta < 0) {
      return 'overview-kpi__trend--down';
    }
    return 'overview-kpi__trend--flat';
  }

  formatMoney(value: string): string {
    const n = Number.parseFloat(value);
    if (Number.isNaN(n)) {
      return value;
    }
    return formatTndDisplay(n);
  }

  formatRole(role: string): string {
    if (role === 'admin') {
      return 'Administrateur';
    }
    if (role === 'client') {
      return 'Client';
    }
    return role;
  }

  formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  logout(): void {
    localStorage.removeItem('kokozito_admin_token');
    localStorage.removeItem('kokozito_admin_refresh');
    localStorage.removeItem('kokozito_admin_role');
    localStorage.removeItem('kokozito_admin_user_id');
    void this.router.navigate(['/']);
  }
}
