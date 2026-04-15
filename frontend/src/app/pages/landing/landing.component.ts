import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { of, switchMap } from 'rxjs';

import { hasAdminSession } from '@app/auth/admin.guard';
import { RegisterModalComponent } from '@app/components/register-modal/register-modal.component';
import type { CartLine } from '@app/models/order-history.model';
import { AnalyticsService } from '@app/services/analytics.service';
import { ClientApiService } from '@app/services/client-api.service';
import { OrderApiService } from '@app/services/order-api.service';
import { OrderHistoryService } from '@app/services/order-history.service';
import { environment } from '../../../environments/environment';
import { formatTndDisplay } from '@app/format-tnd-display';
import { landingImage } from './landing-assets';

export interface BoutiqueProductRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly highlights?: string;
  readonly price: number;
  readonly image_url: string;
  readonly image_urls?: readonly string[];
}

const STORAGE_ACCOUNT = 'kokozito_account';
const STORAGE_CART = 'kokozito_cart';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RegisterModalComponent, RouterLink, RouterLinkActive],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly orderHistoryService = inject(OrderHistoryService);
  private readonly orderApi = inject(OrderApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly analytics = inject(AnalyticsService);

  private cartSyncTimer: ReturnType<typeof setTimeout> | null = null;

  readonly logoSrc = '/media/logo-kokozito.jpg';
  readonly siteBrand = 'Kokozito';
  readonly bagProductTitle = 'Sac de douche pour chats';
  readonly towelProductTitle = 'Serviette à capuche canard';
  readonly towelTagline = 'Ultra-absorbante, ludique et douce après le bain';
  readonly packDuoProductTitle =
    'Pack duo bain — serviette cheveux + capuche canard';
  readonly packDuoTagline =
    'Les deux articles en photo : microfibre cheveux et cape canard';

  ngOnInit(): void {
    this.analytics.pingOncePerSession();
    this.hasAdminDashboard.set(hasAdminSession());
    this.fetchBoutiqueProducts();
    if (typeof localStorage === 'undefined') {
      return;
    }
    this.clientApi
      .ensureTokenFromProfile()
      .pipe(
        switchMap((ok) =>
          ok ? this.clientApi.getCart() : of({ lines: [] as CartLine[] }),
        ),
      )
      .subscribe({
        next: ({ lines }) => {
          const local = this.cartLines();
          if (Array.isArray(lines) && lines.length > 0) {
            this.cartLines.set(lines as CartLine[]);
          } else if (local.length > 0) {
            this.clientApi.putCart(local).subscribe({ error: () => undefined });
          }
        },
        error: () => undefined,
      });
  }

  readonly registerModalOpen = signal(false);

  /** Panneau navigation mobile (liens + Commander / Admin / Mes achats). */
  readonly topbarMenuOpen = signal(false);

  /** Affiche un accès au tableau de bord si une session admin JWT est en cours. */
  readonly hasAdminDashboard = signal(hasAdminSession());

  readonly hasAccount = signal(
    typeof localStorage !== 'undefined' &&
      localStorage.getItem(STORAGE_ACCOUNT) === '1',
  );

  readonly cartLines = signal<CartLine[]>(this.loadCartFromStorageLegacy());

  readonly cartPanelOpen = signal(false);

  readonly cartItemCount = computed(() =>
    this.cartLines().reduce((sum, line) => sum + line.qty, 0),
  );

  readonly cartSubtotal = computed(() =>
    this.cartLines().reduce((sum, line) => sum + line.unitPrice * line.qty, 0),
  );

  /** Livraison 7 000 DT si le panier contient le pack duo, sinon frais démo classiques. */
  readonly cartShippingAmount = computed(() =>
    this.cartLines().some((l) => l.id === 'pack-duo-bain')
      ? environment.demoPackShippingTnd
      : environment.demoShippingTnd,
  );

  readonly cartTotalWithShipping = computed(
    () => this.cartSubtotal() + this.cartShippingAmount(),
  );

  readonly faqOpenIndex = signal<number | null>(0);

  /** Produits créés depuis l’admin (API). */
  readonly boutiqueProducts = signal<BoutiqueProductRow[]>([]);

  /** Index de la photo affichée par produit catalogue (clé = id `sp-…`). */
  readonly boutiqueGalleryIndex = signal<Readonly<Record<string, number>>>({});

  readonly displayUnitPrice = computed(() =>
    this.formatDemoTnd(environment.demoProductPriceTnd),
  );
  readonly displayShipping = computed(() =>
    this.formatDemoTnd(environment.demoShippingTnd),
  );
  readonly displayTotal = computed(() =>
    this.formatDemoTnd(
      environment.demoProductPriceTnd + environment.demoShippingTnd,
    ),
  );

  readonly displayTowelPrice = computed(() =>
    this.formatDemoTnd(environment.demoTowelPriceTnd),
  );
  readonly displayTowelTotal = computed(() =>
    this.formatDemoTnd(
      environment.demoTowelPriceTnd + environment.demoShippingTnd,
    ),
  );

  readonly displayPackPrice = computed(() =>
    this.formatDemoTnd(environment.demoPackDuoPriceTnd),
  );
  readonly displayPackShipping = computed(() =>
    this.formatDemoTnd(environment.demoPackShippingTnd),
  );
  readonly displayPackTotal = computed(() =>
    this.formatDemoTnd(
      environment.demoPackDuoPriceTnd + environment.demoPackShippingTnd,
    ),
  );

  readonly displayCartShipping = computed(() =>
    this.formatDemoTnd(this.cartShippingAmount()),
  );

  /** Photos du sac — navigation dans la section produit */
  readonly bagGalleryImages = [
    landingImage('splitProduct'),
    landingImage('gallery1'),
    landingImage('gallery2'),
    landingImage('lifestyle'),
    landingImage('detail'),
  ] as const;

  readonly bagGalleryIndex = signal(0);

  readonly bagGalleryCurrent = computed(
    () => this.bagGalleryImages[this.bagGalleryIndex()],
  );

  selectBagImage(index: number): void {
    if (index >= 0 && index < this.bagGalleryImages.length) {
      this.bagGalleryIndex.set(index);
    }
  }

  nextBagImage(): void {
    const n = this.bagGalleryImages.length;
    this.bagGalleryIndex.update((i) => (i + 1) % n);
  }

  prevBagImage(): void {
    const n = this.bagGalleryImages.length;
    this.bagGalleryIndex.update((i) => (i - 1 + n) % n);
  }

  /** Une image par gamme pour le panier et aperçus courts. */
  readonly bagShowcaseImage = landingImage('gallery1');
  readonly towelShowcaseImage = landingImage('towelMain');
  readonly packDuoShowcaseImage = landingImage('packDuoBain');

  /** Photos serviette — même principe que le sac */
  readonly towelGalleryImages = [
    landingImage('towelMain'),
    landingImage('towel01'),
    landingImage('towel02'),
    landingImage('towel03'),
    landingImage('towel04'),
    landingImage('towel05'),
  ] as const;

  readonly towelGalleryIndex = signal(0);

  readonly towelGalleryCurrent = computed(
    () => this.towelGalleryImages[this.towelGalleryIndex()],
  );

  selectTowelImage(index: number): void {
    if (index >= 0 && index < this.towelGalleryImages.length) {
      this.towelGalleryIndex.set(index);
    }
  }

  nextTowelImage(): void {
    const n = this.towelGalleryImages.length;
    this.towelGalleryIndex.update((i) => (i + 1) % n);
  }

  prevTowelImage(): void {
    const n = this.towelGalleryImages.length;
    this.towelGalleryIndex.update((i) => (i - 1 + n) % n);
  }

  readonly features = [
    {
      id: 'f1',
      featureLabel: 'Mise en place',
      step: '1',
      text: 'Placez votre chat dans le sac et serrez les cordons en douceur.',
      imageSrc: landingImage('etape02'),
      imageAlt:
        'Étape 1 — placer le chat dans le sac de douche rose et serrer les cordons',
    },
    {
      id: 'f2',
      featureLabel: 'Shampoing',
      step: '2',
      text: 'Appliquez le shampooing sur le mesh, faites mousser et lavez en toute sécurité.',
      imageSrc: landingImage('etape01'),
      imageAlt: 'Étape 2 — chat dans le sac, shampoing et bain en douceur',
    },
    {
      id: 'f3',
      featureLabel: 'Séchage',
      step: '3',
      text: 'Essorez et laissez sécher : moins de stress pour vous et pour lui.',
      imageSrc: landingImage('etape04'),
      imageAlt: 'Étape 3 — séchage du chat dans le sac avec sèche-cheveux',
    },
    {
      id: 'f4',
      featureLabel: 'Griffes',
      step: '4',
      text: 'Accès aux pattes pour couper les griffes sans mauvaise surprise.',
      imageSrc: landingImage('etape03'),
      imageAlt: 'Étape 4 — patte du chat sortie du mesh pour couper les griffes',
    },
  ] as const;

  readonly faqs = [
    {
      id: 'faq1',
      question: 'Le sac de douche convient-il à toutes les tailles de chats ?',
      answer:
        "Oui, le sac est conçu pour convenir à la plupart des tailles de chats grâce à son tissu extensible et respirant. Cela garantit que votre chat se sent à l'aise pendant le bain.",
    },
    {
      id: 'faq2',
      question: 'Comment ce sac aide-t-il à réduire le stress lors du bain ?',
      answer:
        'Le sac de douche permet de réduire le stress du bain grâce à sa conception sécurisée qui immobilise doucement votre chat. De plus, le tissu respirant assure leur confort.',
    },
    {
      id: 'faq3',
      question: 'De quel matériau est fait le sac et comment fonctionne-t-il ?',
      answer:
        "Le sac est fabriqué avec un tissu de haute qualité qui permet une aération optimale tout en étant résistant à l'eau, assurant un séchage rapide et efficace.",
    },
    {
      id: 'faq4',
      question:
        'La serviette à capuche convient-elle aux chats et aux petits chiens ?',
      answer:
        "Oui : la cape en éponge absorbe vite l'humidité après le bain. La capuche motif canard maintient la tête au chaud ; le format drapé s'adapte aux petits animaux pour un séchage rapide sans frisson.",
    },
  ] as const;

  trackById(_index: number, item: { readonly id: string }): string {
    return item.id;
  }

  trackBoutiqueProduct(_index: number, item: BoutiqueProductRow): string {
    return item.id;
  }

  formatBoutiquePrice(value: number): string {
    return this.formatDemoTnd(value);
  }

  boutiqueSectionDomId(p: BoutiqueProductRow): string {
    return `boutique-detail-${p.id}`;
  }

  boutiqueImageList(p: BoutiqueProductRow): readonly string[] {
    const urls = p.image_urls;
    if (urls && urls.length > 0) {
      return urls;
    }
    return p.image_url ? [p.image_url] : [];
  }

  boutiqueHighlights(p: BoutiqueProductRow): readonly string[] {
    const h = (p.highlights ?? '').trim();
    if (!h) {
      return [];
    }
    return h.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }

  boutiqueGalleryIndexFor(p: BoutiqueProductRow): number {
    const imgs = this.boutiqueImageList(p);
    if (imgs.length === 0) {
      return 0;
    }
    const raw = this.boutiqueGalleryIndex()[p.id] ?? 0;
    return Math.max(0, Math.min(raw, imgs.length - 1));
  }

  boutiqueGalleryCurrent(p: BoutiqueProductRow): string {
    const imgs = this.boutiqueImageList(p);
    const i = this.boutiqueGalleryIndexFor(p);
    return imgs[i] ?? '';
  }

  selectBoutiqueGalleryImage(p: BoutiqueProductRow, index: number): void {
    const imgs = this.boutiqueImageList(p);
    if (index < 0 || index >= imgs.length) {
      return;
    }
    this.boutiqueGalleryIndex.update((m) => ({ ...m, [p.id]: index }));
  }

  nextBoutiqueImage(p: BoutiqueProductRow): void {
    const imgs = this.boutiqueImageList(p);
    const n = imgs.length;
    if (n <= 1) {
      return;
    }
    const i = (this.boutiqueGalleryIndexFor(p) + 1) % n;
    this.selectBoutiqueGalleryImage(p, i);
  }

  prevBoutiqueImage(p: BoutiqueProductRow): void {
    const imgs = this.boutiqueImageList(p);
    const n = imgs.length;
    if (n <= 1) {
      return;
    }
    const i = (this.boutiqueGalleryIndexFor(p) - 1 + n) % n;
    this.selectBoutiqueGalleryImage(p, i);
  }

  boutiqueOrderCardImage(p: BoutiqueProductRow): string {
    const xs = this.boutiqueImageList(p);
    return xs[0] ?? '';
  }

  boutiqueLineTotalDisplay(p: BoutiqueProductRow): string {
    return this.formatDemoTnd(p.price + environment.demoShippingTnd);
  }

  private fetchBoutiqueProducts(): void {
    this.http
      .get<{ readonly products: readonly BoutiqueProductRow[] }>(
        `${environment.apiBaseUrl}/api/shop/products/`,
      )
      .subscribe({
        next: (res) => {
          const raw = res.products ?? [];
          this.boutiqueProducts.set(
            raw.map((p) => {
              const imageUrl = p.image_url ?? '';
              const imageUrls =
                Array.isArray(p.image_urls) && p.image_urls.length > 0
                  ? p.image_urls
                  : imageUrl
                    ? [imageUrl]
                    : [];
              return {
                id: p.id,
                name: p.name,
                description: p.description,
                highlights: p.highlights ?? '',
                price: Number.parseFloat(String(p.price)),
                image_url: imageUrl,
                image_urls: imageUrls,
              };
            }),
          );
        },
        error: () => {
          this.boutiqueProducts.set([]);
        },
      });
  }

  scrollToOrder(): void {
    this.smoothScrollToId('commande');
  }

  scrollToOrderFromMenu(): void {
    this.scrollToOrder();
    this.closeTopbarMenu();
  }

  scrollToId(id: string): void {
    this.smoothScrollToId(id);
  }

  scrollToIdFromMenu(id: string): void {
    this.scrollToId(id);
    this.closeTopbarMenu();
  }

  toggleTopbarMenu(): void {
    this.topbarMenuOpen.update((open) => !open);
  }

  closeTopbarMenu(): void {
    this.topbarMenuOpen.set(false);
  }

  private smoothScrollToId(elementId: string): void {
    const el = document.getElementById(elementId);
    if (!el) {
      return;
    }
    const behavior: ScrollBehavior = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
      ? 'auto'
      : 'smooth';

    requestAnimationFrame(() => {
      const topbar = document.querySelector<HTMLElement>('.topbar');
      const headerH = topbar?.offsetHeight ?? 56;
      const gapPx = 12;
      const y =
        el.getBoundingClientRect().top + window.scrollY - headerH - gapPx;
      window.scrollTo({
        top: Math.max(0, y),
        behavior,
      });
    });
  }

  openRegisterModal(): void {
    this.registerModalOpen.set(true);
  }

  closeRegisterModal(): void {
    this.registerModalOpen.set(false);
  }

  onAccountCreated(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_ACCOUNT, '1');
    }
    this.hasAccount.set(true);
    this.orderHistoryService.refreshFromServer();
  }

  onCartButtonClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closeTopbarMenu();
    if (!this.hasAccount()) {
      this.cartPanelOpen.set(false);
      this.registerModalOpen.set(true);
      return;
    }
    this.cartPanelOpen.update((open) => !open);
  }

  closeCartPanel(): void {
    this.cartPanelOpen.set(false);
  }

  addToCart(
    productId: string,
    options?: { readonly label: string; readonly unitPrice: number; readonly imageUrl?: string },
  ): void {
    if (!this.hasAccount()) {
      this.registerModalOpen.set(true);
      return;
    }
    let label = options?.label;
    let unitPrice = options?.unitPrice;
    const imageUrl = options?.imageUrl;
    if (label == null || unitPrice == null) {
      if (productId === 'bag') {
        label = this.bagProductTitle;
        unitPrice = environment.demoProductPriceTnd;
      } else if (productId === 'towel') {
        label = this.towelProductTitle;
        unitPrice = environment.demoTowelPriceTnd;
      } else if (productId === 'pack-duo-bain') {
        label = this.packDuoProductTitle;
        unitPrice = environment.demoPackDuoPriceTnd;
      } else {
        return;
      }
    }
    this.cartLines.update((lines) => {
      const i = lines.findIndex((l) => l.id === productId);
      if (i >= 0) {
        const next = [...lines];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      const line: CartLine = { id: productId, label, unitPrice, qty: 1 };
      if (imageUrl) {
        line.imageUrl = imageUrl;
      }
      return [...lines, line];
    });
    this.persistCart();
  }

  decrementCartLine(productId: string): void {
    this.cartLines.update((lines) =>
      lines
        .map((l) => (l.id === productId ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    );
    this.persistCart();
  }

  removeCartLine(productId: string): void {
    this.cartLines.update((lines) => lines.filter((l) => l.id !== productId));
    this.persistCart();
  }

  continueFromCart(): void {
    const lines = this.cartLines();
    const hasLines = lines.length > 0;
    this.cartPanelOpen.set(false);
    if (hasLines) {
      const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
      const shipping = this.cartShippingAmount();
      const total = subtotal + shipping;
      const payload = this.orderApi.buildPayloadFromCart(
        lines,
        subtotal,
        shipping,
        total,
      );
      if (!payload) {
        this.scrollToOrder();
        return;
      }
      this.orderApi.syncOrder(payload).subscribe({
        next: () => {
          if (!environment.production) {
            console.debug('[Kokozito] Commande enregistrée côté serveur.');
          }
          this.orderHistoryService.refreshFromServer();
          if (
            typeof localStorage !== 'undefined' &&
            localStorage.getItem('kokozito_client_token')
          ) {
            this.clientApi.putCart([]).subscribe({ error: () => undefined });
          }
          this.cartLines.set([]);
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(STORAGE_CART);
          }
          void this.router.navigate(['/mes-achats'], {
            queryParams: { merci: '1' },
          });
        },
        error: (err: unknown) => {
          console.error(
            '[Kokozito] Échec envoi de la commande au serveur. Vérifiez que Django tourne sur',
            environment.apiBaseUrl,
            err,
          );
        },
      });
    } else {
      this.scrollToOrder();
    }
  }

  cartProductImage(line: CartLine): string {
    if (line.imageUrl) {
      return line.imageUrl;
    }
    if (line.id.startsWith('sp-')) {
      const hit = this.boutiqueProducts().find((x) => x.id === line.id);
      if (hit) {
        return this.boutiqueOrderCardImage(hit);
      }
    }
    if (line.id === 'bag') {
      return this.bagShowcaseImage;
    }
    if (line.id === 'towel') {
      return this.towelShowcaseImage;
    }
    if (line.id === 'pack-duo-bain') {
      return this.packDuoShowcaseImage;
    }
    return this.bagShowcaseImage;
  }

  onCartPageBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeCartPanel();
    }
  }

  displayCartMoney(value: number): string {
    return this.formatDemoTnd(value);
  }

  @HostListener('document:keydown.escape')
  onEscapeCloseCart(): void {
    if (this.topbarMenuOpen()) {
      this.closeTopbarMenu();
      return;
    }
    if (
      this.cartPanelOpen() &&
      this.hasAccount() &&
      !this.registerModalOpen()
    ) {
      this.closeCartPanel();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const t = event.target as HTMLElement | null;
    if (
      this.topbarMenuOpen() &&
      !t?.closest('.topbar__sheet') &&
      !t?.closest('.topbar__menu-btn') &&
      !t?.closest('.topbar__backdrop')
    ) {
      this.closeTopbarMenu();
    }
    if (t?.closest('.topbar__cart-wrap') || t?.closest('.cart-page')) {
      return;
    }
    this.cartPanelOpen.set(false);
  }

  /** Panier local si pas encore de jeton client (anciens parcours). */
  private loadCartFromStorageLegacy(): CartLine[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    try {
      const raw = localStorage.getItem(STORAGE_CART);
      if (!raw) {
        return [];
      }
      const data = JSON.parse(raw) as CartLine[];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  /** Panier en base (jeton client) ou localStorage (fallback). */
  private persistCart(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const lines = this.cartLines();
    const token = localStorage.getItem('kokozito_client_token');
    if (token) {
      if (this.cartSyncTimer !== null) {
        clearTimeout(this.cartSyncTimer);
      }
      this.cartSyncTimer = setTimeout(() => {
        this.cartSyncTimer = null;
        this.clientApi.putCart(lines).subscribe({ error: () => undefined });
      }, 400);
    } else {
      localStorage.setItem(STORAGE_CART, JSON.stringify(lines));
    }
  }

  toggleFaq(index: number): void {
    this.faqOpenIndex.update((current) => (current === index ? null : index));
  }

  private formatDemoTnd(value: number): string {
    return formatTndDisplay(value);
  }
}
