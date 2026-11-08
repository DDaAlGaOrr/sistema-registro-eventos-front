import { Component, computed, effect, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { ApiError } from '../../core/models';
import { AdminApiService } from '../admin-api.service';
import { AuditEntry, AuditFilters, Member, Page } from '../admin.models';
import { EventContextService } from '../event-context.service';
import { RegistrationPanelComponent } from '../registrations/registration-panel.component';

const PAGE_SIZE = 50;
/** La API filtra por el inicio del nombre de la acción ("payment" trae payment.recorded, payment.refunded…). */
const ACTION_GROUPS = ['registration', 'payment', 'event', 'form', 'church', 'user', 'tenant', 'auth'] as const;

/** Día (YYYY-MM-DD) en la zona del navegador → instante ISO de su inicio. */
export function startOfDayIso(date: string, addDays = 0): string {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + addDays);
    return d.toISOString();
}

/** Auditoría: quién hizo qué y cuándo, con filtros y el detalle de cada cambio. */
@Component({
    selector: 'app-audit-page',
    standalone: true,
    imports: [TranslateModule, RegistrationPanelComponent],
    template: `
    <div class="mb-3">
      <h1 class="page-title">{{ 'V2.PANEL.MENU.AUDIT' | translate }}</h1>
      <p class="page-subtitle">{{ 'V2.ADMIN.AUDIT.SUBTITLE' | translate }}</p>
    </div>

    <div class="panel-card mb-3">
      <div class="row g-2">
        <div class="col-6 col-md-3">
          <select class="form-select" (change)="setFilter('action', $any($event.target).value)">
            <option value="">{{ 'V2.ADMIN.AUDIT.ALL_ACTIONS' | translate }}</option>
            @for (g of groups; track g) { <option [value]="g" [selected]="g === filters().action">{{ ('V2.ADMIN.AUDIT.GROUP.' + g) | translate }}</option> }
          </select>
        </div>
        <div class="col-6 col-md-3">
          <select class="form-select" (change)="setFilter('actorUserId', $any($event.target).value ? +$any($event.target).value : null)">
            <option value="">{{ 'V2.ADMIN.AUDIT.ALL_PEOPLE' | translate }}</option>
            @for (m of members(); track m.userId) { <option [value]="m.userId" [selected]="m.userId === filters().actorUserId">{{ m.name }}</option> }
          </select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small mb-0 text-muted">{{ 'V2.ADMIN.AUDIT.FROM' | translate }}</label>
          <input type="date" class="form-control" [value]="fromDate()" (change)="setDates($any($event.target).value, toDate())" />
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small mb-0 text-muted">{{ 'V2.ADMIN.AUDIT.TO' | translate }}</label>
          <input type="date" class="form-control" [value]="toDate()" (change)="setDates(fromDate(), $any($event.target).value)" />
        </div>
      </div>
      <div class="d-flex flex-wrap gap-3 mt-2 align-items-center">
        <label class="form-check mb-0 small">
          <input type="checkbox" class="form-check-input" [checked]="onlyThisEvent()" (change)="onlyThisEvent.set($any($event.target).checked); page.set(1)" />
          <span class="form-check-label">{{ 'V2.ADMIN.AUDIT.ONLY_EVENT' | translate }}</span>
        </label>
      </div>
    </div>

    @if (error()) { <div class="alert alert-danger">{{ error()!.message }}</div> }

    <div class="panel-card p-0 overflow-hidden">
      <div class="table-responsive">
        <table class="table align-middle mb-0 au-table" [class.is-loading]="loading()">
          <thead><tr>
            <th>{{ 'V2.ADMIN.AUDIT.WHEN' | translate }}</th>
            <th>{{ 'V2.ADMIN.AUDIT.WHO' | translate }}</th>
            <th>{{ 'V2.ADMIN.AUDIT.WHAT' | translate }}</th>
            <th class="d-none d-md-table-cell">{{ 'V2.ADMIN.AUDIT.ON' | translate }}</th>
            <th></th>
          </tr></thead>
          <tbody>
            @for (e of data()?.items ?? []; track e.id) {
              <tr class="au-row" (click)="toggle(e.id)">
                <td class="small text-nowrap">{{ when(e.createdAt) }}</td>
                <td>{{ e.actor.name || actorType(e.actor.type) }}</td>
                <td><strong>{{ actionLabel(e.action) }}</strong></td>
                <td class="d-none d-md-table-cell small text-muted">{{ e.entityType }}@if (e.entityId) { #{{ e.entityId }} }</td>
                <td class="text-end"><i class="bi" [class.bi-chevron-down]="expanded() !== e.id" [class.bi-chevron-up]="expanded() === e.id"></i></td>
              </tr>
              @if (expanded() === e.id) {
                <tr class="au-detail">
                  <td colspan="5">
                    @if (hasDetail(e)) { <pre class="au-pre">{{ detail(e) }}</pre> }
                    @else { <span class="text-muted small">{{ 'V2.ADMIN.AUDIT.NO_DETAIL' | translate }}</span> }
                    @if (e.entityType === 'registration' && numericId(e); as rid) {
                      <button type="button" class="btn btn-sm btn-outline-secondary mt-2" (click)="openRegistration(rid); $event.stopPropagation()">
                        <i class="bi bi-person-lines-fill"></i> {{ 'V2.ADMIN.AUDIT.OPEN_REGISTRATION' | translate }}</button>
                    }
                  </td>
                </tr>
              }
            } @empty {
              @if (!loading()) { <tr><td colspan="5" class="text-center text-muted py-5">{{ 'V2.ADMIN.AUDIT.EMPTY' | translate }}</td></tr> }
            }
          </tbody>
        </table>
      </div>
      @if (data(); as d) {
        <div class="pager">
          <span class="small text-muted">{{ from() }}–{{ to() }} / {{ d.total }}</span>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() <= 1 || loading()" (click)="page.set(page() - 1)" [attr.aria-label]="'V2.ADMIN.LIST.PREV' | translate"><i class="bi bi-chevron-left"></i></button>
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="to() >= d.total || loading()" (click)="page.set(page() + 1)" [attr.aria-label]="'V2.ADMIN.LIST.NEXT' | translate"><i class="bi bi-chevron-right"></i></button>
          </div>
        </div>
      }
    </div>

    @if (selectedId(); as id) {
      <app-registration-panel [registrationId]="id" initialTab="history" [includeDeleted]="true" [timezone]="context.current()?.timezone"
                              (closed)="selectedId.set(null)" />
    }
  `,
    styles: [`
    .au-table.is-loading { opacity: .55; transition: opacity .15s; }
    .au-table th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
    .au-row { cursor: pointer; }
    .au-detail td { background: var(--surface-muted); }
    .au-pre { margin: 0; font-size: 12px; white-space: pre-wrap; word-break: break-word; max-height: 260px; overflow: auto; }
    .pager { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--border); }
  `],
})
export class AuditPageComponent {
    readonly context = inject(EventContextService);
    private api = inject(AdminApiService);
    private language = inject(LanguageService);
    private translate = inject(TranslateService);

    readonly groups = ACTION_GROUPS;
    readonly filters = signal<AuditFilters>({});
    readonly onlyThisEvent = signal(true);
    readonly fromDate = signal('');
    readonly toDate = signal('');
    readonly page = signal(1);
    readonly data = signal<Page<AuditEntry> | null>(null);
    readonly members = signal<Member[]>([]);
    readonly loading = signal(false);
    readonly error = signal<ApiError | null>(null);
    readonly expanded = signal<number | null>(null);
    readonly selectedId = signal<number | null>(null);

    readonly from = computed(() => (this.data()?.total ? (this.page() - 1) * PAGE_SIZE + 1 : 0));
    readonly to = computed(() => Math.min(this.page() * PAGE_SIZE, this.data()?.total ?? 0));

    constructor() {
        this.api.members().subscribe({ next: m => this.members.set(m), error: () => undefined });

        effect((onCleanup) => {
            const eventId = this.context.currentEventId();
            const filters = { ...this.filters(), eventId: this.onlyThisEvent() ? eventId : null };
            const page = this.page();
            if (this.onlyThisEvent() && !eventId) return;
            this.loading.set(true);
            this.error.set(null);
            const sub = this.api.audit(filters, page, PAGE_SIZE).subscribe({
                next: d => { this.data.set(d); this.loading.set(false); },
                error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
            });
            onCleanup(() => sub.unsubscribe());
        }, { allowSignalWrites: true });
    }

    setFilter<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) {
        this.filters.update(f => ({ ...f, [key]: value || undefined }));
        this.page.set(1);
    }

    setDates(from: string, to: string) {
        this.fromDate.set(from);
        this.toDate.set(to);
        this.filters.update(f => ({
            ...f,
            from: from ? startOfDayIso(from) : undefined,
            // "hasta" incluye todo ese día
            to: to ? startOfDayIso(to, 1) : undefined,
        }));
        this.page.set(1);
    }

    toggle(id: number) { this.expanded.update(cur => (cur === id ? null : id)); }

    actionLabel(action: string) {
        this.language.currentLang();
        const key = `V2.ADMIN.AUDIT_ACTION.${action.replace(/\./g, '_')}`;
        const text = this.translate.instant(key);
        return text === key ? action : text;
    }

    actorType(type: string) {
        return this.translate.instant(type === 'stripe' ? 'V2.ADMIN.AUDIT.ACTOR_STRIPE' : 'V2.ADMIN.REG.SYSTEM');
    }

    hasDetail(e: AuditEntry) { return !!e.changes || !!e.metadata; }

    detail(e: AuditEntry) {
        return JSON.stringify({ ...(e.changes ? { changes: e.changes } : {}), ...(e.metadata ? { metadata: e.metadata } : {}) }, null, 2);
    }

    numericId(e: AuditEntry): number | null {
        const n = Number(e.entityId);
        return Number.isInteger(n) && n > 0 ? n : null;
    }

    openRegistration(id: number) { this.selectedId.set(id); }

    when(iso: string) {
        return new Intl.DateTimeFormat(this.language.currentLang() === 'es' ? 'es-MX' : 'en-US', {
            dateStyle: 'medium', timeStyle: 'medium', timeZone: this.context.current()?.timezone,
        }).format(new Date(iso));
    }
}
