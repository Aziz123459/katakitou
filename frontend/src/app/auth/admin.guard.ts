import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

/** Jeton admin présent et rôle `admin` (aligné sur la garde de route). */
export function hasAdminSession(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  const token = localStorage.getItem('kokozito_admin_token');
  const role = localStorage.getItem('kokozito_admin_role');
  return !!(token && role === 'admin');
}

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (hasAdminSession()) {
    return true;
  }
  void router.navigate(['/']);
  return false;
};
