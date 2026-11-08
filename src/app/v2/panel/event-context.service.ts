import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiV2Service } from '../core/api.service';
import { ApiError, EventSummary } from '../core/models';
import { TenantService } from '../core/tenant.service';

/** Eventos que el usuario puede ver y el evento elegido en el panel. */
@Injectable({ providedIn: 'root' })
export class EventContextService {
    private api = inject(ApiV2Service);
    private tenant = inject(TenantService);

    readonly events = signal<EventSummary[] | null>(null);
    readonly error = signal<ApiError | null>(null);
    readonly currentEventId = signal<number | null>(null);
    readonly current = computed(() => this.events()?.find(e => e.id === this.currentEventId()) ?? null);

    private get storageKey() { return `v2.ultimoEvento.${this.tenant.slug ?? 'plataforma'}`; }

    load(force = false) {
        if (this.events() && !force) return;
        this.error.set(null);
        this.api.get<EventSummary[]>('/events').subscribe({
            next: list => this.events.set(list),
            error: (e: ApiError) => this.error.set(e),
        });
    }

    select(eventId: number | null) {
        this.currentEventId.set(eventId);
        if (eventId) {
            try { localStorage.setItem(this.storageKey, String(eventId)); } catch { /* sin almacenamiento */ }
        }
    }

    /** Último evento abierto en este navegador (para entrar directo). */
    lastEventId(): number | null {
        try {
            const v = Number(localStorage.getItem(this.storageKey));
            return Number.isInteger(v) && v > 0 ? v : null;
        } catch {
            return null;
        }
    }

    reset() {
        this.events.set(null);
        this.currentEventId.set(null);
    }
}
