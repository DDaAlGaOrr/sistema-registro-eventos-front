import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { API_V2 } from '../../environment/environment';
import { ApiEnvelope, ApiError } from './models';

type Params = Record<string, string | number | boolean | null | undefined>;

const toParams = (params?: Params) => {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) {
        if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    }
    return p;
};

/** Convierte cualquier error HTTP en { status, message, details } en español. */
export function toApiError(err: unknown): ApiError {
    if (err instanceof HttpErrorResponse) {
        if (err.status === 0) return { status: 0, message: 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.' };
        const body = err.error as { message?: string; details?: unknown } | null;
        return { status: err.status, message: body?.message ?? 'Ocurrió un error inesperado', details: body?.details };
    }
    return { status: -1, message: 'Ocurrió un error inesperado' };
}

/**
 * Cliente de la API V2. Desenvuelve { status, data } y normaliza errores.
 * El header X-Tenant y el token los agrega el interceptor.
 */
@Injectable({ providedIn: 'root' })
export class ApiV2Service {
    private http = inject(HttpClient);

    get<T>(path: string, params?: Params): Observable<T> {
        return this.http.get<ApiEnvelope<T>>(`${API_V2}${path}`, { params: toParams(params) }).pipe(
            map(r => r.data),
            catchError(e => throwError(() => toApiError(e))),
        );
    }

    post<T>(path: string, body: unknown = {}): Observable<T> {
        return this.http.post<ApiEnvelope<T>>(`${API_V2}${path}`, body).pipe(
            map(r => r.data),
            catchError(e => throwError(() => toApiError(e))),
        );
    }

    patch<T>(path: string, body: unknown): Observable<T> {
        return this.http.patch<ApiEnvelope<T>>(`${API_V2}${path}`, body).pipe(
            map(r => r.data),
            catchError(e => throwError(() => toApiError(e))),
        );
    }

    put<T>(path: string, body: unknown): Observable<T> {
        return this.http.put<ApiEnvelope<T>>(`${API_V2}${path}`, body).pipe(
            map(r => r.data),
            catchError(e => throwError(() => toApiError(e))),
        );
    }

    delete<T>(path: string, body?: unknown): Observable<T> {
        return this.http.delete<ApiEnvelope<T>>(`${API_V2}${path}`, { body }).pipe(
            map(r => r.data),
            catchError(e => throwError(() => toApiError(e))),
        );
    }
}
