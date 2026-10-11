import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Interceptor che aggiunge header Authorization Bearer alle richieste HTTP.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (/\/auth\/login(?:[?#]|$)/.test(req.url)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = authService.getToken();

  if (!token) {
    return next(req);
  }

  const authenticatedRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authenticatedRequest);
};
