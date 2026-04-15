/**
 * Visuels dans `frontend/public/media/shop/` (noms courts, compatibles URL).
 * Source : copie depuis `kokozito/adpic/` — mettre à jour les fichiers dans ce dossier si besoin.
 */
export const SHOP_MEDIA_BASE = '/media/shop';

const SHOP_FILES = {
  heroMain: 'hero-main.png',
  splitProduct: 'product-sheet.jpg',
  storyWide: 'story-wide.png',
  lifestyle: 'lifestyle.png',
  detail: 'detail.png',
  step1: 'step-01.jpg',
  step2: 'step-02.jpg',
  step3: 'step-03.jpg',
  step4: 'step-04.jpg',
  /**
   * Étapes — copies depuis `adpic/` :
   * etape-01 = ChatGPT …03_49_37, etape-02 = …03_49_43,
   * etape-03 = IMG-…WA0016, etape-04 = IMG-…WA0017.
   * L’ordre affiché (1→4) est défini dans `landing.component.ts` → `features`.
   */
  etape01: 'etape-01.png',
  etape02: 'etape-02.png',
  etape03: 'etape-03.jpg',
  etape04: 'etape-04.jpg',
  gallery1: 'gallery-01.jpg',
  gallery2: 'gallery-02.jpg',
  gallery3: 'gallery-03.jpg',
  gallery4: 'gallery-04.jpg',
  gallery5: 'gallery-05.jpg',
  gallery6: 'gallery-06.jpg',
  gallery7: 'gallery-07.jpg',
  gallery8: 'gallery-08.jpg',
  orderThumb: 'order-thumb.jpg',
  towelMain: 'towel-main.jpg',
  /** Bloc « duo story » serviette (vue à plat) */
  towelDuo: 'towel-duo.jpg',
  towel01: 'towel-01.jpg',
  towel02: 'towel-02.jpg',
  towel03: 'towel-03.jpg',
  towel04: 'towel-04.jpg',
  towel05: 'towel-05.jpg',
  /** Pack duo : serviette microfibre cheveux + serviette capuche canard (visuel unique). */
  packDuoBain: 'pack-duo-bain.jpg',
} as const;

export const landingImage = (key: keyof typeof SHOP_FILES): string =>
  `${SHOP_MEDIA_BASE}/${SHOP_FILES[key]}`;
