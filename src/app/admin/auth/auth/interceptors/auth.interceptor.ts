import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../service/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const token = authService.getToken();

    // Si hay token, agregarlo al header de cada petición
    const authReq = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

    return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
            // 🚨 CORRECCIÓN: Solo hacer logout si el error 401 NO viene del endpoint de login
            // Si estás usando el mock local, asegúrate de que no interfiera con el flujo del formulario.
            if (error.status === 401 && !req.url.includes('/auth/login')) {
                authService.logout();
            }
            return throwError(() => error);
        })
    );
};
