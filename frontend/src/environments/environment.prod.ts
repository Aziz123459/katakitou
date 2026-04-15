/**
 * Production — remplacez `apiBaseUrl` par l’URL HTTPS réelle de l’API Django
 * (sans slash final), puis `ng build` avant déploiement statique (Pages, Netlify, etc.).
 * Même URL doit apparaître dans `DJANGO_CORS_ALLOWED_ORIGINS` côté serveur.
 */
export const environment = {
  production: true,
  demoShippingTnd: 7,
  demoProductPriceTnd: 32,
  demoTowelPriceTnd: 28,
  demoPackDuoPriceTnd: 60_000,
  demoPackShippingTnd: 7_000,
  apiBaseUrl: 'https://REMPLACEZ-VOTRE-API.onrender.com',
};
