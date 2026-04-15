export interface CartLine {
  id: string;
  label: string;
  unitPrice: number;
  qty: number;
  /** URL absolue (produits boutique) pour vignettes panier / historique. */
  imageUrl?: string;
}

export interface OrderHistoryEntry {
  readonly id: string;
  readonly confirmedAt: string;
  readonly lines: readonly CartLine[];
  readonly subtotal: number;
  readonly shipping: number;
  readonly total: number;
}
