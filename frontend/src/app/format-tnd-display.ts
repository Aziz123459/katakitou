/**
 * Affichage des montants en DT : virgule comme séparateur des milliers (ex. 60,000 DT).
 */
export function formatTndDisplay(value: number): string {
  return (
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
      useGrouping: true,
    }).format(value) + ' DT'
  );
}
