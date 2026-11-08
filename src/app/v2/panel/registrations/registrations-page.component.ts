import { Component, computed, effect, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { CanDirective } from '../../core/can.directive';
import { formatMoney } from '../../core/i18n';
import { ApiError } from '../../core/models';
import { AdminApiService, conferencesOf } from '../admin-api.service';
import {
    OrgNode, Page, RegistrationDetail, RegistrationFilters, RegistrationListItem, RegistrationSort,
} from '../admin.models';
import { PAYMENT_BADGE, STATUS_BADGE } from '../admin.utils';
import { EventContextService } from '../event-context.service';
import { RegistrationPanelComponent } from './registration-panel.component';

const PAGE_SIZES = [25, 50, 100];
const SEARCH_DELAY_MS = 350;

/** Directorio de registros del evento: filtros, tabla paginada en el servidor y panel lateral. */
@Component({
    selector: 'app-registrations-page',
    standalone: true,
    imports: [TranslateModule, CanDirective, RegistrationPanelComponent],
    template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <h1 class="page-title">{{ 'V2.PANEL.MENU.REGISTRATIONS' | translate }}</h1>
        @if (data(); as d) { <p class="page-subtitle">{{ 'V2.ADMIN.LIST.COUNT' | translate: { n: d.total } }}</p> }
      </div>
      <button type="button" class="btn btn-outline-secondary" [disabled]="exporting() || !data()?.total" (click)="exportCsv()">
        <i class="bi bi-download"></i> {{ (exporting() ? 'V2.ADMIN.LIST.EXPORTING' : 'V2.ADMIN.LIST.EXPORT') | translate }}
      </button>
    </div>

    <div class="panel-card filters mb-3">
      <div class="row g-2">
        <div class="col-12 col-md-4">
          <input type="search" class="form-control" [placeholder]="'V2.ADMIN.LIST.SEARCH' | translate"
                 [value]="searchText()" (input)="onSearch($any($event.target).value)" />
        </div>
        @if (conferences().length > 1) {
          <div class="col-6 col-md-2">
            <select class="form-select" (change)="setFilter('conferenceId', $any($event.target).value ? +$any($event.target).value : null)">
              <option value="" [selected]="!filters().conferenceId">{{ 'V2.ADMIN.LIST.ALL_CONFERENCES' | translate }}</option>
              @for (c of conferences(); track c.id) { <option [value]="c.id" [selected]="c.id === filters().conferenceId">{{ c.shortName || c.name }}</option> }
            </select>
          </div>
        }
        <div class="col-6 col-md-2">
          <select class="form-select" (change)="setFilter('paymentStatus', $any($event.target).value)">
            <option value="">{{ 'V2.ADMIN.LIST.ALL_PAYMENTS' | translate }}</option>
            @for (s of paymentStatuses; track s) { <option [value]="s" [selected]="s === filters().paymentStatus">{{ ('V2.ADMIN.PAYMENT_STATUS.' + s) | translate }}</option> }
          </select>
        </div>
        <div class="col-6 col-md-2">
          <select class="form-select" (change)="setFilter('checkedIn', $any($event.target).value)">
            <option value="">{{ 'V2.ADMIN.LIST.ALL_CHECKIN' | translate }}</option>
            <option value="true" [selected]="filters().checkedIn === 'true'">{{ 'V2.ADMIN.LIST.CHECKED_IN' | translate }}</option>
            <option value="false" [selected]="filters().checkedIn === 'false'">{{ 'V2.ADMIN.LIST.NOT_CHECKED_IN' | translate }}</option>
          </select>
        </div>
        <div class="col-6 col-md-2">
          <select class="form-select" (change)="setFilter('status', $any($event.target).value)">
            <option value="">{{ 'V2.ADMIN.LIST.ALL_STATUS' | translate }}</option>
            @for (s of statuses; track s) { <option [value]="s" [selected]="s === filters().status">{{ ('V2.ADMIN.STATUS.' + s) | translate }}</option> }
          </select>
        </div>
      </div>
      <div class="d-flex flex-wrap gap-3 mt-2 align-items-center">
        <label *appCan="'registrations.delete'" class="form-check mb-0 small">
          <input type="checkbox" class="form-check-input" [checked]="filters().deleted === 'only'"
                 (change)="setFilter('deleted', $any($event.target).checked ? 'only' : '')" />
          <span class="form-check-label">{{ 'V2.ADMIN.LIST.TRASH' | translate }}</span>
        </label>
        @if (hasFilters()) {
          <button type="button" class="btn btn-link btn-sm p-0" (click)="clearFilters()">{{ 'V2.ADMIN.LIST.CLEAR' | translate }}</button>
        }
      </div>
    </div>

    @if (error()) {
      <div class="alert alert-danger">{{ error()!.message }}
        <button type="button" class="btn btn-link btn-sm p-0 ms-2" (click)="reload()">{{ 'V2.COMMON.RETRY' | translate }}</button></div>
    }

    <div class="panel-card p-0 overflow-hidden">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 reg-table" [class.is-loading]="loading()">
          <thead>
            <tr>
              <th><button type="button" class="sort" (click)="sortBy('last_name')">{{ 'V2.ADMIN.LIST.NAME' | translate }}{{ arrow('last_name') }}</button></th>
              <th class="d-none d-md-table-cell">{{ 'V2.ADMIN.LIST.CONFERENCE' | translate }}</th>
              <th class="d-none d-lg-table-cell">{{ 'V2.ADMIN.LIST.CHURCH' | translate }}</th>
              <th>{{ 'V2.ADMIN.LIST.PAYMENT' | translate }}</th>
              <th class="text-center"><button type="button" class="sort" (click)="sortBy('checked_in_at')">{{ 'V2.ADMIN.LIST.CHECKIN' | translate }}{{ arrow('checked_in_at') }}</button></th>
              <th class="d-none d-md-table-cell"><button type="button" class="sort" (click)="sortBy('created_at')">{{ 'V2.ADMIN.LIST.REGISTERED' | translate }}{{ arrow('created_at') }}</button></th>
            </tr>
          </thead>
          <tbody>
            @for (r of data()?.items ?? []; track r.id) {
              <tr class="reg-row" [class.reg-row--deleted]="!!r.deletedAt" tabindex="0" (click)="open(r)" (keydown.enter)="open(r)">
                <td>
                  <div class="fw-semibold">{{ r.lastName }}, {{ r.firstName }}</div>
                  <div class="small text-muted text-truncate cell-email">{{ r.email }}</div>
                </td>
                <td class="d-none d-md-table-cell">{{ r.conference?.shortName || '—' }}</td>
                <td class="d-none d-lg-table-cell">{{ r.church?.name || r.churchNameRaw || '—' }}</td>
                <td>
                  <span class="badge {{ paymentBadge[r.paymentStatus] }}">{{ ('V2.ADMIN.PAYMENT_STATUS.' + r.paymentStatus) | translate }}</span>
                  <div class="small text-muted">{{ money(r.paidCents) }} / {{ money(r.totalCents) }}</div>
                </td>
                <td class="text-center">
                  @if (r.checkedInAt) { <i class="bi bi-check-circle-fill text-success" [title]="'V2.ADMIN.REG.CHECKED_IN' | translate"></i> }
                  @else { <i class="bi bi-dash text-muted"></i> }
                </td>
                <td class="d-none d-md-table-cell small">{{ shortDate(r.createdAt) }}</td>
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="6" class="text-center text-muted py-5">{{ 'V2.ADMIN.LIST.EMPTY' | translate }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
      @if (data(); as d) {
        <div class="pager">
          <span class="small text-muted">{{ rangeFrom() }}–{{ rangeTo() }} / {{ d.total }}</span>
          <div class="d-flex align-items-center gap-2">
            <select class="form-select form-select-sm w-auto" (change)="setPageSize(+$any($event.target).value)">
              @for (s of pageSizes; track s) { <option [value]="s" [selected]="s === pageSize()">{{ s }}</option> }
            </select>
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() <= 1 || loading()" (click)="goTo(page() - 1)" [attr.aria-label]="'V2.ADMIN.LIST.PREV' | translate"><i class="bi bi-chevron-left"></i></button>
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() >= pages() || loading()" (click)="goTo(page() + 1)" [attr.aria-label]="'V2.ADMIN.LIST.NEXT' | translate"><i class="bi bi-chevron-right"></i></button>
          </div>
        </div>
      }
    </div>

    @if (selectedId(); as id) {
      <app-registration-panel [registrationId]="id" [timezone]="context.current()?.timezone"
                              [includeDeleted]="filters().deleted === 'only'"
                              (closed)="selectedId.set(null)" (changed)="onChanged($event)" />
    }
  `,
    styles: [`
    .reg-table.is-loading { opacity: .55; transition: opacity .15s; }
    .reg-table th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
    .sort { background: none; border: 0; padding: 0; font: inherit; text-transform: inherit; letter-spacing: inherit; color: inherit; cursor: pointer; }
    .sort:hover { color: var(--text); }
    .reg-row { cursor: pointer; }
    .reg-row--deleted { opacity: .6; }
    .cell-email { max-width: 220px; }
    .pager { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--border); }
  `],
})
export class RegistrationsPageComponent {
    readonly context = inject(EventContextService);
    private api = inject(AdminApiService);
    private language = inject(LanguageService);

    readonly paymentBadge = PAYMENT_BADGE;
    readonly statusBadge = STATUS_BADGE;
    readonly pageSizes = PAGE_SIZES;
    readonly paymentStatuses = ['paid', 'partially_paid', 'unpaid', 'not_required', 'refunded'] as const;
    readonly statuses = ['confirmed', 'pending_payment', 'cancelled'] as const;

    readonly filters = signal<RegistrationFilters>({});
    readonly searchText = signal('');
    readonly page = signal(1);
    readonly pageSize = signal(25);
    readonly sort = signal<RegistrationSort>('created_at');
    readonly order = signal<'asc' | 'desc'>('desc');
    private readonly reloadTick = signal(0);

    readonly data = signal<Page<RegistrationListItem> | null>(null);
    readonly loading = signal(false);
    readonly error = signal<ApiError | null>(null);
    readonly exporting = signal(false);
    readonly selectedId = signal<number | null>(null);
    readonly conferences = signal<OrgNode[]>([]);

    readonly pages = computed(() => Math.max(1, Math.ceil((this.data()?.total ?? 0) / this.pageSize())));
    readonly rangeFrom = computed(() => (this.data()?.total ? (this.page() - 1) * this.pageSize() + 1 : 0));
    readonly rangeTo = computed(() => Math.min(this.page() * this.pageSize(), this.data()?.total ?? 0));
    readonly hasFilters = computed(() => Object.values(this.filters()).some(v => v !== undefined && v !== null && v !== ''));

    private searchTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.api.organizationTree().subscribe({ next: t => this.conferences.set(conferencesOf(t)), error: () => undefined });

        // Vuelve a pedir la lista cuando cambia el evento, un filtro, la página o el orden
        effect((onCleanup) => {
            const eventId = this.context.currentEventId();
            const filters = this.filters();
            const paging = { page: this.page(), pageSize: this.pageSize(), sort: this.sort(), order: this.order() };
            this.reloadTick();
            if (!eventId) return;
            this.loading.set(true);
            this.error.set(null);
            const sub = this.api.registrations(eventId, filters, paging).subscribe({
                next: d => {
                    this.data.set(d);
                    this.loading.set(false);
                    // Si se quedó en una página que ya no existe (se borraron registros), regresa a la última
                    const last = Math.max(1, Math.ceil(d.total / paging.pageSize));
                    if (paging.page > last) this.page.set(last);
                },
                error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
            });
            onCleanup(() => sub.unsubscribe());
        }, { allowSignalWrites: true });
    }

    reload() { this.reloadTick.update(n => n + 1); }

    // ── Filtros ───────────────────────────────────────────────────────

    onSearch(text: string) {
        this.searchText.set(text);
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.setFilter('q', text), SEARCH_DELAY_MS);
    }

    setFilter<K extends keyof RegistrationFilters>(key: K, value: RegistrationFilters[K]) {
        this.filters.update(f => ({ ...f, [key]: value }));
        this.page.set(1);
    }

    clearFilters() {
        this.filters.set({});
        this.searchText.set('');
        this.page.set(1);
    }

    // ── Orden y páginas ───────────────────────────────────────────────

    sortBy(column: RegistrationSort) {
        if (this.sort() === column) this.order.update(o => (o === 'asc' ? 'desc' : 'asc'));
        else { this.sort.set(column); this.order.set(column === 'last_name' ? 'asc' : 'desc'); }
        this.page.set(1);
    }

    arrow(column: RegistrationSort) { return this.sort() === column ? (this.order() === 'asc' ? ' ↑' : ' ↓') : ''; }

    goTo(page: number) { this.page.set(Math.min(Math.max(page, 1), this.pages())); }

    setPageSize(size: number) { this.pageSize.set(size); this.page.set(1); }

    // ── Panel y exportación ───────────────────────────────────────────

    open(r: RegistrationListItem) { this.selectedId.set(r.id); }

    /** Algo cambió en el panel: se refresca la lista (el registro puede haber salido del filtro). */
    onChanged(_: RegistrationDetail) { this.reload(); }

    exportCsv() {
        const eventId = this.context.currentEventId();
        if (!eventId) return;
        this.exporting.set(true);
        this.api.exportCsv(eventId, this.filters(), this.language.currentLang()).subscribe({
            next: blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `registros-${this.context.current()?.slug ?? eventId}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                this.exporting.set(false);
            },
            error: (e: ApiError) => { this.exporting.set(false); this.error.set(e); },
        });
    }

    money(cents: number) { return formatMoney(cents, this.language.currentLang()); }

    shortDate(iso: string) {
        return new Intl.DateTimeFormat(this.language.currentLang() === 'es' ? 'es-MX' : 'en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: this.context.current()?.timezone,
        }).format(new Date(iso));
    }
}
