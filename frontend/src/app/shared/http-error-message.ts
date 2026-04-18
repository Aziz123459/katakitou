import { HttpErrorResponse } from '@angular/common/http';

export interface HttpErrorMessageOptions {
  /** Message si 401 sans corps `detail` explicite. */
  readonly unauthorizedFallback?: string;
  /** Message si 400 sans détail exploitable. */
  readonly invalidPayloadFallback?: string;
}

function fromDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }
  if (Array.isArray(detail) && detail.length) {
    const parts = detail.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    if (parts.length) {
      return parts.join(' ');
    }
  }
  return null;
}

function fromFieldErrors(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  for (const value of Object.values(payload as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length) {
      const parts = value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      if (parts.length) {
        return parts.join(' ');
      }
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

/**
 * Texte utilisateur à partir d’une erreur HTTP Angular (réseau, 4xx, 5xx, JSON DRF).
 */
export function messageForHttpError(
  err: HttpErrorResponse,
  options?: HttpErrorMessageOptions,
): string {
  const status = err.status;
  const body = err.error;

  if (status === 0) {
    return (
      'Connexion impossible au serveur. Vérifiez votre connexion internet, ou que l’API est ' +
      'joignable (adresse du site, CORS, déploiement).'
    );
  }

  if (status === 401) {
    return (
      fromDetail(body) ||
      options?.unauthorizedFallback ||
      'Accès refusé. Vérifiez vos informations.'
    );
  }

  if (status === 400) {
    return (
      fromDetail(body) ||
      fromFieldErrors(body) ||
      options?.invalidPayloadFallback ||
      'Les informations envoyées ne sont pas valides. Vérifiez les champs du formulaire.'
    );
  }

  if (status === 403) {
    return fromDetail(body) || 'Accès refusé par le serveur.';
  }

  if (status === 404) {
    return (
      'Ressource introuvable sur le serveur. ' +
      'L’URL de l’API est peut‑être incorrecte ou le service n’est pas déployé.'
    );
  }

  if (status === 408 || status === 504) {
    return 'Le serveur a mis trop longtemps à répondre. Réessayez dans un instant.';
  }

  if (status === 429) {
    return 'Trop de requêtes. Patientez quelques minutes puis réessayez.';
  }

  if (status >= 500) {
    return (
      'Le serveur rencontre un problème temporaire. Réessayez plus tard ou contactez ' +
      'l’équipe technique si le problème continue.'
    );
  }

  if (typeof body === 'string' && body.trim().length > 0 && body.length < 600) {
    return body.trim();
  }

  return `Une erreur inattendue s’est produite (code ${status}). Réessayez dans un moment.`;
}
