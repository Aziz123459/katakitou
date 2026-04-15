import { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const base = environment.apiBaseUrl;
  if (!req.url.startsWith(base)) {
    return next(req);
  }

  if (req.url.includes('/api/admin/')) {
    const token =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('kokozito_admin_token')
        : null;
    if (!token) {
      return next(req);
    }
    return next(
      req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      }),
    );
  }

  if (req.url.includes('/api/client/')) {
    const clientToken =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('kokozito_client_token')
        : null;
    if (!clientToken) {
      return next(req);
    }
    return next(
      req.clone({
        setHeaders: {
          Authorization: `ClientToken ${clientToken}`,
        },
      }),
    );
  }

  return next(req);
};
