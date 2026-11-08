import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { API_V2, BASE_DOMAINS, DEFAULT_TENANT, PLATFORM_SUBDOMAIN } from '../../environment/environment';
import { ApiEnvelope, TenantBranding } from './models';

export type TenantState =
    | { kind: 'tenant'; branding: TenantBranding }
    | { kind: 'platform' }
    | { kind: 'not_found'; slug: string }
    | { kind: 'error' };

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Cliente (unión/asociación) de esta página, según el subdominio:
 *   pacific.tuapp.com → "pacific"   ·   app.tuapp.com → panel de plataforma
 * En localhost sin subdominio se usa DEFAULT_TENANT.
 */
export function detectTenantSlug(hostname: string): string | null | 'platform' {
    const host = hostname.toLowerCase();
    for (const base of BASE_DOMAINS) {
        if (host.endsWith(`.${base}`)) {
            const sub = host.slice(0, -(base.length + 1));
            if (sub === PLATFORM_SUBDOMAIN) return 'platform';
            if (SLUG.test(sub)) return sub;
        }
    }
    return DEFAULT_TENANT;
}

@Injectable({ providedIn: 'root' })
export class TenantService {
    private http = inject(HttpClient);
    private document = inject(DOCUMENT);

    /** Slug que se manda en el header X-Tenant (null = plataforma). */
    readonly slug: string | null;
    readonly state = signal<TenantState>({ kind: 'platform' });

    constructor() {
        const detected = detectTenantSlug(this.document.location.hostname);
        this.slug = detected === 'platform' ? null : detected;
    }

    get branding(): TenantBranding | null {
        const s = this.state();
        return s.kind === 'tenant' ? s.branding : null;
    }

    /** Se llama al arrancar la app: carga la marca y la aplica (colores, título). */
    async load(): Promise<void> {
        if (!this.slug) {
            this.state.set({ kind: 'platform' });
            return;
        }
        try {
            const res = await firstValueFrom(this.http.get<ApiEnvelope<TenantBranding>>(`${API_V2}/tenant/public`, {
                headers: { 'X-Tenant': this.slug },
            }));
            this.state.set({ kind: 'tenant', branding: res.data });
            this.applyBranding(res.data);
        } catch (err: any) {
            this.state.set(err?.status === 404 ? { kind: 'not_found', slug: this.slug } : { kind: 'error' });
        }
    }

    private applyBranding(b: TenantBranding) {
        const root = this.document.documentElement;
        if (b.primaryColor) root.style.setProperty('--brand-primary', b.primaryColor);
        if (b.secondaryColor) root.style.setProperty('--brand-secondary', b.secondaryColor);
        this.document.title = b.name;
    }
}
