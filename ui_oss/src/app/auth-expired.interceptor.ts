import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { PROTOCOL_VERSION } from './shared/messages';

/**
 * On a 401/403 the v2 app must NOT show a login page inside the iframe.
 * It tells the shell, which performs a full-page redirect (docs/app1.md Phase 3).
 */
export const authExpiredInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if ((err.status === 401 || err.status === 403) && window.parent !== window) {
        window.parent.postMessage(
          { v: PROTOCOL_VERSION, type: 'v2:auth-expired' },
          location.origin,
        );
      }
      return throwError(() => err);
    }),
  );
