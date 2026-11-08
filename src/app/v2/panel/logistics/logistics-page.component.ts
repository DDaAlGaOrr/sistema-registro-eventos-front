import { Component, computed, effect, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { I18nPipe, formatMoney } from '../../core/i18n';
import { ApiError, I18nText } from '../../core/models';
import { AdminApiService } from '../admin-api.service';
import { EventReport, RegistrationFilters } from '../admin.models';
import { saveBlob, toCsv, toDeliver } from '../admin.utils';
import { EventContextService } from '../event-context.service';

type Variant = EventReport['items'][number]['variants'][number];

/**
 * Logística: lo que hay que comprar y entregar. Totales por producto y talla
 * (pagado / pendiente / entregado), respuestas con opciones (dieta) y listas
 * en CSV para el proveedor o para entregar en la puerta.
 */
@Component({
    selector: 'app-logistics-page',
    standalone: true,
    imports: [TranslateModule, I18nPipe],
    template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <h1 class="page-title">{{ 'V2.PANEL.MENU.LOGISTICS' | translate }}</h1>
        <p class="page-subtitle">{{ 'V2.ADMIN.LOGISTICS.SUBTITLE' | translate }}</p>
      </div>
      <button type="button" class="btn btn-outline-secondary" [disabled]="!report()" (click)="downloadSummary()">
        <i class="bi bi-download"></i> {{ 'V2.ADMIN.LOGISTICS.SUMMARY_CSV' | translate }}</button>
    </div>

    @if (error()) { <div class="alert alert-danger">{{ error()!.message }}</div> }

    @if (report(); as r) {
      @if (!r.items.length && !r.answers.length) {
        <div class="panel-card text-center text-muted py-5">{{ 'V2.ADMIN.LOGISTICS.EMPTY' | translate }}</div>
      }

      @for (item of r.items; track item.code) {
        <div class="panel-card mb-3">
          <div class="d-flex justify-content-between align-items-center gap-2 mb-2">
            <h2 class="card-title mb-0">{{ item.name | i18n }}</h2>
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="exporting() !== null" (click)="downloadList(item.code, null, item.name)">
              <i class="bi bi-list-check"></i> {{ 'V2.ADMIN.LOGISTICS.LIST_CSV' | translate }}</button>
          </div>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0 lg-table">
              <thead>
                <tr>
                  <th>{{ 'V2.ADMIN.LOGISTICS.VARIANT' | translate }}</th>
                  <th class="text-end">{{ 'V2.ADMIN.LOGISTICS.TOTAL' | translate }}</th>
                  <th class="text-end">{{ 'V2.ADMIN.LOGISTICS.PAID' | translate }}</th>
                  <th class="text-end">{{ 'V2.ADMIN.LOGISTICS.UNPAID' | translate }}</th>
                  <th class="text-end">{{ 'V2.ADMIN.LOGISTICS.DELIVERED' | translate }}</th>
                  <th class="text-end">{{ 'V2.ADMIN.LOGISTICS.TO_DELIVER' | translate }}</th>
                  <th class="text-end d-none d-md-table-cell">{{ 'V2.ADMIN.LOGISTICS.AMOUNT' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (v of item.variants; track $index) {
                  <tr>
                    <td>{{ variantName(v) | i18n }}</td>
                    <td class="text-end fw-semibold">{{ v.total }}</td>
                    <td class="text-end">{{ v.paid + v.notRequired }}</td>
                    <td class="text-end" [class.text-danger]="v.unpaid > 0">{{ v.unpaid }}</td>
                    <td class="text-end">{{ v.delivered }}</td>
                    <td class="text-end fw-semibold">{{ toDeliver(v) }}</td>
                    <td class="text-end d-none d-md-table-cell">{{ money(v.cents) }}</td>
                    <td class="text-end">
                      @if (v.variant) {
                        <button type="button" class="btn btn-sm btn-link p-0" [disabled]="exporting() !== null"
                                [title]="'V2.ADMIN.LOGISTICS.LIST_CSV' | translate" (click)="downloadList(item.code, v.variant, item.name)">
                          <i class="bi bi-download"></i></button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
              @if (item.variants.length > 1) {
                <tfoot>
                  <tr class="fw-semibold">
                    <td>{{ 'V2.ADMIN.LOGISTICS.TOTAL' | translate }}</td>
                    <td class="text-end">{{ sum(item.variants, 'total') }}</td>
                    <td class="text-end">{{ sum(item.variants, 'paid') + sum(item.variants, 'notRequired') }}</td>
                    <td class="text-end">{{ sum(item.variants, 'unpaid') }}</td>
                    <td class="text-end">{{ sum(item.variants, 'delivered') }}</td>
                    <td class="text-end">{{ toDeliverSum(item.variants) }}</td>
                    <td class="text-end d-none d-md-table-cell">{{ money(sum(item.variants, 'cents')) }}</td>
                    <td></td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        </div>
      }

      @if (r.answers.length) {
        <div class="row g-3">
          @for (a of r.answers; track a.key) {
            <div class="col-12 col-md-6 col-xl-4">
              <div class="panel-card h-100">
                <h2 class="card-title">{{ a.label | i18n }}</h2>
                <table class="table table-sm mb-0">
                  <tbody>
                    @for (c of a.counts; track c.value) {
                      <tr><td>{{ c.label ? (c.label | i18n) : c.value }}</td><td class="text-end fw-semibold">{{ c.count }}</td></tr>
                    }
                    @if (a.unanswered) {
                      <tr class="text-muted"><td>{{ 'V2.ADMIN.LOGISTICS.UNANSWERED' | translate }}</td><td class="text-end">{{ a.unanswered }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      }
    } @else if (!error()) {
      <p class="text-muted">{{ 'V2.COMMON.LOADING' | translate }}</p>
    }
  `,
    styles: [`
    .card-title { font-size: 15px; font-weight: 600; margin: 0 0 12px; }
    .lg-table th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
  `],
})
export class LogisticsPageComponent {
    readonly context = inject(EventContextService);
    private api = inject(AdminApiService);
    private language = inject(LanguageService);
    private translate = inject(TranslateService);

    readonly report = signal<EventReport | null>(null);
    readonly error = signal<ApiError | null>(null);
    /** Lista que se está descargando (para no lanzar varias a la vez). */
    readonly exporting = signal<string | null>(null);
    readonly toDeliver = toDeliver;

    readonly eventSlug = computed(() => this.context.current()?.slug ?? 'evento');

    constructor() {
        effect(() => {
            const id = this.context.currentEventId();
            if (!id) return;
            this.report.set(null);
            this.error.set(null);
            this.api.report(id).subscribe({ next: r => this.report.set(r), error: (e: ApiError) => this.error.set(e) });
        }, { allowSignalWrites: true });
    }

    variantName(v: Variant) {
        return v.label ?? { es: v.variant ?? 'Único', en: v.variant ?? 'Single' };
    }

    sum(variants: Variant[], key: 'total' | 'paid' | 'notRequired' | 'unpaid' | 'delivered' | 'cents') {
        return variants.reduce((n, v) => n + v[key], 0);
    }

    toDeliverSum(variants: Variant[]) { return variants.reduce((n, v) => n + toDeliver(v), 0); }

    money(cents: number) { return formatMoney(cents, this.language.currentLang()); }

    private t(key: string) { return this.translate.instant(`V2.ADMIN.LOGISTICS.${key}`); }

    /** Lista de personas (CSV) que pidieron el producto o la talla, para entregar o conciliar. */
    downloadList(itemCode: string, variantCode: string | null, itemName: I18nText) {
        const eventId = this.context.currentEventId();
        if (!eventId) return;
        const filters: RegistrationFilters = { itemCode, ...(variantCode ? { variantCode } : {}) };
        this.exporting.set(`${itemCode}:${variantCode ?? ''}`);
        this.api.exportCsv(eventId, filters, this.language.currentLang()).subscribe({
            next: blob => {
                const name = `${itemName[this.language.currentLang()]} ${variantCode ?? ''}`;
                const safe = name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
                saveBlob(blob, `lista-${safe}-${this.eventSlug()}.csv`);
                this.exporting.set(null);
            },
            error: (e: ApiError) => { this.exporting.set(null); this.error.set(e); },
        });
    }

    /** Resumen para el proveedor: una fila por producto y talla. */
    downloadSummary() {
        const r = this.report();
        if (!r) return;
        const lang = this.language.currentLang();
        const rows: unknown[][] = [[this.t('CSV_PRODUCT'), this.t('VARIANT'), this.t('TOTAL'), this.t('PAID'), this.t('UNPAID'), this.t('DELIVERED'), this.t('TO_DELIVER')]];
        for (const item of r.items) {
            for (const v of item.variants) {
                rows.push([item.name[lang], v.label?.[lang] ?? v.variant ?? '', v.total, v.paid + v.notRequired, v.unpaid, v.delivered, toDeliver(v)]);
            }
        }
        for (const a of r.answers) {
            for (const c of a.counts) rows.push([a.label[lang], c.label?.[lang] ?? c.value, c.count, '', '', '', '']);
        }
        saveBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `logistica-${this.eventSlug()}.csv`);
    }
}
