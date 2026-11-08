import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_V2 } from '../../environment/environment';
import { SessionService } from './session.service';
import { TenantService } from './tenant.service';

/** Rutas de /auth que no deben intentar renovar la sesión al recibir 401. */
const NO_RETRY = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/password/', '/auth/invitation/'];

/**
 * Solo para la API V2:
 *  - agrega X-Tenant (cliente del subdominio) y el access token;
 *  - si responde 401, renueva la sesión una vez y repite la petición;
 *    si no se puede renovar, manda al login.
 */
export const apiV2Interceptor: HttpInterceptorFn = (req, next) => {
    if (!req.url.startsWith(API_V2)) return next(req);

    const tenant = inject(TenantService);
    const session = inject(SessionService);
    const path = req.url.slice(API_V2.length);

    const withHeaders = (token: string | undefined) => {
        const headers: Record<string, string> = {};
        if (tenant.slug && !req.headers.has('X-Tenant')) headers['X-Tenant'] = tenant.slug;
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return req.clone({ setHeaders: headers, withCredentials: path.startsWith('/auth/') });
    };

    const token = session.session()?.accessToken;
    return next(withHeaders(token)).pipe(
        catchError((err: HttpErrorResponse) => {
            const canRetry = err.status === 401 && !!token && !NO_RETRY.some(p => path.startsWith(p));
            if (!canRetry) return throwError(() => err);
            return session.refresh().pipe(
                catchError(() => {
                    session.expire();
                    return throwError(() => err);
                }),
                switchMap(s => next(withHeaders(s.accessToken))),
            );
        }),
    );
};
