import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay, tap, throwError } from 'rxjs';
import { API_V2 } from '../../environment/environment';
import { toApiError } from './api.service';
import { ApiEnvelope, Permission, Session } from './models';

/**
 * Sesión V2:
 *  - access token (15 min) solo en memoria: no queda en localStorage;
 *  - refresh token en cookie httpOnly (el navegador la manda sola a /auth);
 *  - al recargar la página se recupera la sesión con /auth/refresh.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
    private http = inject(HttpClient);
    private router = inject(Router);

    readonly session = signal<Session | null>(null);
    readonly isLoggedIn = computed(() => this.session() !== null);
    readonly permissions = computed(() => new Set(this.session()?.permissions ?? []));

    private restoring: Promise<boolean> | null = null;
    private refreshing$: Observable<Session> | null = null;

    can(permission: Permission | Permission[]): boolean {
        const perms = this.permissions();
        return (Array.isArray(permission) ? permission : [permission]).some(p => perms.has(p));
    }

    login(email: string, password: string): Observable<Session> {
        return this.http.post<ApiEnvelope<Session>>(`${API_V2}/auth/login`, { email, password }, { withCredentials: true }).pipe(
            map(r => r.data),
            tap(s => this.session.set(s)),
            catchError(e => throwError(() => toApiError(e))),
        );
    }

    /** Para flujos que ya traen sesión (aceptar invitación). */
    setSession(session: Session) {
        this.session.set(session);
        this.restoring = Promise.resolve(true);
    }

    /** Renueva el access token con la cookie. Si hay varias peticiones a la vez, se hace una sola. */
    refresh(): Observable<Session> {
        this.refreshing$ ??= this.http.post<ApiEnvelope<Session>>(`${API_V2}/auth/refresh`, {}, { withCredentials: true }).pipe(
            map(r => r.data),
            tap(s => this.session.set(s)),
            finalize(() => { this.refreshing$ = null; }),
            shareReplay(1),
        );
        return this.refreshing$;
    }

    /** Al cargar la app: ¿hay una sesión que se pueda recuperar? (una sola vez). */
    restore(): Promise<boolean> {
        if (this.session()) return Promise.resolve(true);
        this.restoring ??= firstValueFrom(this.refresh().pipe(map(() => true), catchError(() => of(false))))
            .then(ok => {
                if (!ok) this.restoring = null;
                return ok;
            });
        return this.restoring;
    }

    logout(): void {
        this.http.post(`${API_V2}/auth/logout`, {}, { withCredentials: true }).pipe(catchError(() => of(null)))
            .subscribe(() => {
                this.clear();
                this.router.navigate(['/login']);
            });
    }

    /** La sesión venció y no se pudo renovar. */
    expire(): void {
        this.clear();
        this.router.navigate(['/login'], { queryParams: { expirada: 1, volver: this.router.url } });
    }

    private clear() {
        this.session.set(null);
        this.restoring = null;
    }
}
