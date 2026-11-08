import { Component, effect, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { formatMoney } from '../../core/i18n';
import { ApiError } from '../../core/models';
import { AdminApiService } from '../admin-api.service';
import { EventPayment, EventPaymentsPage, Page, PaymentFilters, PaymentStatus, RegistrationListItem } from '../admin.models';
import { saveBlob } from '../admin.utils';
import { EventContextService } from '../event-context.service';
import { RegistrationPanelComponent } from '../registrations/registration-panel.component';

type Tab = 'movements' | 'pending';

const PAGE_SIZE = 25;
const METHODS = ['stripe', 'cash', 'check', 'zelle', 'other', 'legacy'] as const;
const STATUSES = ['succeeded', 'partially_refunded', 'refunded', 'canceled', 'pending', 'failed'] as const;
const STATUS_BADGE: Record<string, string> = {
    succeeded: 'text-bg-success', partially_refunded: 'text-bg-warning', refunded: 'text-bg-info',
    canceled: 'text-bg-secondary', pending: 'text-bg-light border', failed: 'text-bg-danger',
};

/**
 * Pagos del evento: movimientos (con totales y filtros) y lo que falta por cobrar.
 * Registrar, anular y reembolsar se hace en el panel del registro, que se abre al elegir una fila.
 */
@Component({
    selector: 'app-payments-page',
    standalone: true,
    imports: [TranslateModule, RegistrationPanelComponent],
    template: `
    <div class="mb-3">
      <h1 class="page-title">{{ 'V2.PANEL.MENU.PAYMENTS' | translate }}</h1>
      <p class="page-subtitle">{{ 'V2.ADMIN.PAY.SUBTITLE' | translate }}</p>
    </div>

    @if (totals(); as t) {
      <div class="row g-3 mb-3">
        <div class="col-12 col-md-4"><div class="panel-card"><div class="text-muted small">{{ 'V2.ADMIN.PAY.COLLECTED' | translate }}</div><div class="fs-3 fw-bold">{{ money(t.collectedCents) }}</div></div></div>
        <div class="col-6 col-md-4"><div class="panel-card"><div class="text-muted small">{{ 'V2.ADMIN.PAY.REFUNDED' | translate }}</div><div class="fs-3 fw-bold">{{ money(t.refundedCents) }}</div></div></div>
        <div class="col-6 col-md-4"><div class="panel-card"><div class="text-muted small">{{ 'V2.ADMIN.PAY.NET' | translate }}</div><div class="fs-3 fw-bold">{{ money(t.netCents) }}</div></div></div>
      </div>
    }

    <ul class="nav nav-pills mb-3 pg-tabs">
      <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab() === 'movements'" (click)="setTab('movements')">{{ 'V2.ADMIN.PAY.TAB_MOVEMENTS' | translate }}</button></li>
      <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab() === 'pending'" (click)="setTab('pending')">{{ 'V2.ADMIN.PAY.TAB_PENDING' | translate }}</button></li>
    </ul>

    @if (error()) { <div class="alert alert-danger">{{ error()!.message }}</div> }

    @if (tab() === 'movements') {
      <div class="panel-card mb-3">
        <div class="row g-2">
          <div class="col-6 col-md-3">
            <select class="form-select" (change)="setMethod($any($event.target).value)">
              <option value="">{{ 'V2.ADMIN.PAY.ALL_METHODS' | translate }}</option>
              @for (m of methods; track m) { <option [value]="m" [selected]="m === filters().method">{{ ('V2.ADMIN.METHOD.' + m) | translate }}</option> }
            </select>
          </div>
          <div class="col-6 col-md-3">
            <select class="form-select" (change)="setStatus($any($event.target).value)">
              <option value="">{{ 'V2.ADMIN.PAY.ALL_STATUS' | translate }}</option>
              @for (s of statuses; track s) { <option [value]="s" [selected]="s === filters().status">{{ ('V2.ADMIN.PAYMENT_ROW.' + s) | translate }}</option> }
            </select>
          </div>
        </div>
      </div>

      <div class="panel-card p-0 overflow-hidden">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 pg-table" [class.is-loading]="loading()">
            <thead><tr>
              <th>{{ 'V2.ADMIN.PAY.DATE' | translate }}</th>
              <th>{{ 'V2.ADMIN.LIST.NAME' | translate }}</th>
              <th>{{ 'V2.ADMIN.PAY.METHOD' | translate }}</th>
              <th class="text-end">{{ 'V2.ADMIN.PAY.AMOUNT' | translate }}</th>
              <th class="d-none d-md-table-cell">{{ 'V2.ADMIN.PAY.RECORDED_BY' | translate }}</th>
            </tr></thead>
            <tbody>
              @for (p of payments()?.items ?? []; track p.id) {
                <tr class="pg-row" tabindex="0" (click)="open(p.registration.id)" (keydown.enter)="open(p.registration.id)">
                  <td class="small">{{ shortDate(p.paidAt ?? p.createdAt) }}</td>
                  <td><div class="fw-semibold">{{ p.registration.lastName }}, {{ p.registration.firstName }}</div>
                    @if (p.reference) { <div class="small text-muted">{{ p.reference }}</div> }</td>
                  <td>{{ ('V2.ADMIN.METHOD.' + p.method) | translate }}
                    <div><span class="badge {{ statusBadge(p.status) }}">{{ ('V2.ADMIN.PAYMENT_ROW.' + p.status) | translate }}</span></div></td>
                  <td class="text-end">
                    <span [class.text-decoration-line-through]="p.status === 'canceled' || p.status === 'refunded'">{{ money(p.amountCents) }}</span>
                    @if (p.refundedCents) { <div class="small text-muted">−{{ money(p.refundedCents) }}</div> }
                  </td>
                  <td class="d-none d-md-table-cell small">{{ p.recordedBy || '—' }}</td>
                </tr>
              } @empty {
                @if (!loading()) { <tr><td colspan="5" class="text-center text-muted py-5">{{ 'V2.ADMIN.PAY.EMPTY' | translate }}</td></tr> }
              }
            </tbody>
          </table>
        </div>
        @if (payments(); as d) {
          <div class="pager">
            <span class="small text-muted">{{ from(d.total) }}–{{ to(d.total) }} / {{ d.total }}</span>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() <= 1 || loading()" (click)="page.set(page() - 1)" [attr.aria-label]="'V2.ADMIN.LIST.PREV' | translate"><i class="bi bi-chevron-left"></i></button>
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="to(d.total) >= d.total || loading()" (click)="page.set(page() + 1)" [attr.aria-label]="'V2.ADMIN.LIST.NEXT' | translate"><i class="bi bi-chevron-right"></i></button>
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
        <select class="form-select w-auto" (change)="setPendingStatus($any($event.target).value)">
          <option value="unpaid" [selected]="pendingStatus() === 'unpaid'">{{ 'V2.ADMIN.PAYMENT_STATUS.unpaid' | translate }}</option>
          <option value="partially_paid" [selected]="pendingStatus() === 'partially_paid'">{{ 'V2.ADMIN.PAYMENT_STATUS.partially_paid' | translate }}</option>
        </select>
        <button type="button" class="btn btn-outline-secondary ms-auto" [disabled]="exporting() || !pending()?.total" (click)="exportPending()">
          <i class="bi bi-download"></i> {{ 'V2.ADMIN.LIST.EXPORT' | translate }}</button>
      </div>
      <div class="panel-card p-0 overflow-hidden">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 pg-table" [class.is-loading]="loading()">
            <thead><tr>
              <th>{{ 'V2.ADMIN.LIST.NAME' | translate }}</th>
              <th class="d-none d-md-table-cell">{{ 'V2.ADMIN.LIST.CONFERENCE' | translate }}</th>
              <th class="text-end">{{ 'V2.ADMIN.PAY.PENDING' | translate }}</th>
            </tr></thead>
            <tbody>
              @for (r of pending()?.items ?? []; track r.id) {
                <tr class="pg-row" tabindex="0" (click)="open(r.id)" (keydown.enter)="open(r.id)">
                  <td><div class="fw-semibold">{{ r.lastName }}, {{ r.firstName }}</div><div class="small text-muted">{{ r.email }}</div></td>
                  <td class="d-none d-md-table-cell">{{ r.conference?.shortName || '—' }}</td>
                  <td class="text-end fw-semibold">{{ money(r.totalCents - r.paidCents) }}</td>
                </tr>
              } @empty {
                @if (!loading()) { <tr><td colspan="3" class="text-center text-muted py-5">{{ 'V2.ADMIN.PAY.NOTHING_PENDING' | translate }}</td></tr> }
              }
            </tbody>
          </table>
        </div>
        @if (pending(); as d) {
          <div class="pager">
            <span class="small text-muted">{{ from(d.total) }}–{{ to(d.total) }} / {{ d.total }}</span>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() <= 1 || loading()" (click)="page.set(page() - 1)" [attr.aria-label]="'V2.ADMIN.LIST.PREV' | translate"><i class="bi bi-chevron-left"></i></button>
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="to(d.total) >= d.total || loading()" (click)="page.set(page() + 1)" [attr.aria-label]="'V2.ADMIN.LIST.NEXT' | translate"><i class="bi bi-chevron-right"></i></button>
            </div>
          </div>
        }
      </div>
    }

    @if (selectedId(); as id) {
      <app-registration-panel [registrationId]="id" initialTab="payments" [timezone]="context.current()?.timezone"
                              (closed)="selectedId.set(null)" (changed)="reload()" />
    }
  `,
    styles: [`
    .pg-tabs .nav-link { color: var(--text); }
    .pg-tabs .nav-link.active { background: var(--brand-primary); color: #fff; }
    .pg-table.is-loading { opacity: .55; transition: opacity .15s; }
    .pg-table th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
    .pg-row { cursor: pointer; }
    .pager { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--border); }
  `],
})
export class PaymentsPageComponent {
    readonly context = inject(EventContextService);
    private api = inject(AdminApiService);
    private language = inject(LanguageService);

    readonly methods = METHODS;
    readonly statuses = STATUSES;
    readonly tab = signal<Tab>('movements');
    readonly filters = signal<PaymentFilters>({});
    readonly pendingStatus = signal<PaymentStatus>('unpaid');
    readonly page = signal(1);
    private readonly tick = signal(0);

    readonly payments = signal<EventPaymentsPage | null>(null);
    readonly pending = signal<Page<RegistrationListItem> | null>(null);
    readonly totals = signal<EventPaymentsPage['totals'] | null>(null);
    readonly loading = signal(false);
    readonly error = signal<ApiError | null>(null);
    readonly exporting = signal(false);
    readonly selectedId = signal<number | null>(null);

    constructor() {
        // Los movimientos (y los totales) o la lista de pendientes, según la pestaña, filtros y página
        effect((onCleanup) => {
            const eventId = this.context.currentEventId();
            const tab = this.tab();
            const page = this.page();
            const filters = this.filters();
            const pendingStatus = this.pendingStatus();
            this.tick();
            if (!eventId) return;
            this.loading.set(true);
            this.error.set(null);
            const fail = (e: ApiError) => { this.error.set(e); this.loading.set(false); };
            const sub = tab === 'movements'
                ? this.api.eventPayments(eventId, filters, page, PAGE_SIZE).subscribe({
                    next: d => { this.payments.set(d); this.totals.set(d.totals); this.loading.set(false); }, error: fail,
                })
                : this.api.registrations(eventId, { paymentStatus: pendingStatus }, { page, pageSize: PAGE_SIZE, sort: 'last_name', order: 'asc' }).subscribe({
                    next: d => { this.pending.set(d); this.loading.set(false); }, error: fail,
                });
            onCleanup(() => sub.unsubscribe());
        }, { allowSignalWrites: true });
    }

    reload() { this.tick.update(n => n + 1); }

    setTab(tab: Tab) { this.tab.set(tab); this.page.set(1); }

    setMethod(value: string) { this.filters.update(f => ({ ...f, method: value as PaymentFilters['method'] })); this.page.set(1); }
    setStatus(value: string) { this.filters.update(f => ({ ...f, status: value })); this.page.set(1); }
    setPendingStatus(value: string) { this.pendingStatus.set(value as PaymentStatus); this.page.set(1); }

    open(registrationId: number) { this.selectedId.set(registrationId); }

    from(total: number) { return total ? (this.page() - 1) * PAGE_SIZE + 1 : 0; }
    to(total: number) { return Math.min(this.page() * PAGE_SIZE, total); }

    statusBadge(status: EventPayment['status']) { return STATUS_BADGE[status] ?? 'text-bg-secondary'; }
    money(cents: number) { return formatMoney(cents, this.language.currentLang()); }

    shortDate(iso: string) {
        return new Intl.DateTimeFormat(this.language.currentLang() === 'es' ? 'es-MX' : 'en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: this.context.current()?.timezone,
        }).format(new Date(iso));
    }

    exportPending() {
        const eventId = this.context.currentEventId();
        if (!eventId) return;
        this.exporting.set(true);
        this.api.exportCsv(eventId, { paymentStatus: this.pendingStatus() }, this.language.currentLang()).subscribe({
            next: blob => { saveBlob(blob, `por-cobrar-${this.context.current()?.slug ?? eventId}.csv`); this.exporting.set(false); },
            error: (e: ApiError) => { this.exporting.set(false); this.error.set(e); },
        });
    }
}
