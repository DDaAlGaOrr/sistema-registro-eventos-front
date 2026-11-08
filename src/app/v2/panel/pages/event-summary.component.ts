import { Component, effect, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { ApiV2Service } from '../../core/api.service';
import { I18nPipe, formatEventDates, formatMoney } from '../../core/i18n';
import { ApiError } from '../../core/models';
import { EventContextService } from '../event-context.service';

interface ReportTotals {
    registrations: number;
    checkedIn: number;
    totalCents: number;
    paidCents: number;
    pendingCents: number;
}

/**
 * Resumen del evento. En este paso muestra los indicadores principales;
 * las gráficas y tablas completas llegan en el Paso 11.
 */
@Component({
    selector: 'app-event-summary',
    standalone: true,
    imports: [TranslateModule, I18nPipe],
    template: `
    @if (context.current(); as event) {
      <div class="mb-4">
        <h1 class="page-title">{{ event.name | i18n }}</h1>
        <p class="page-subtitle">{{ dates() }}@if (event.venue) { · {{ event.venue }} }</p>
      </div>

      @if (error()) {
        <div class="alert alert-danger">{{ error()!.message }}</div>
      } @else if (!totals()) {
        <p class="text-muted">{{ 'V2.COMMON.LOADING' | translate }}</p>
      } @else {
        <div class="row g-3 mb-3">
          @for (kpi of kpis(); track kpi.label) {
            <div class="col-6 col-lg-3">
              <div class="panel-card kpi">
                <div class="kpi__label"><i class="bi {{ kpi.icon }}"></i>{{ kpi.label | translate }}</div>
                <div class="kpi__value">{{ kpi.value }}</div>
              </div>
            </div>
          }
        </div>
        <p class="text-muted small"><i class="bi bi-info-circle me-1"></i>{{ 'V2.PANEL.SUMMARY_NOTE' | translate }}</p>
      }
    }
  `,
    styles: [`
    .kpi__label { font-size: 13px; color: var(--text-muted); display: flex; gap: 6px; align-items: center; }
    .kpi__value { font-size: 26px; font-weight: 700; margin-top: 6px; }
  `],
})
export class EventSummaryComponent {
    readonly context = inject(EventContextService);
    private api = inject(ApiV2Service);
    private language = inject(LanguageService);

    readonly totals = signal<ReportTotals | null>(null);
    readonly error = signal<ApiError | null>(null);

    constructor() {
        // Recarga al cambiar de evento
        effect(() => {
            const id = this.context.currentEventId();
            if (!id) return;
            this.totals.set(null);
            this.error.set(null);
            this.api.get<{ totals: ReportTotals }>(`/events/${id}/report`).subscribe({
                next: r => this.totals.set(r.totals),
                error: (e: ApiError) => this.error.set(e),
            });
        }, { allowSignalWrites: true });
    }

    dates() {
        const e = this.context.current();
        return e ? formatEventDates(e, this.language.currentLang()) : '';
    }

    kpis() {
        const t = this.totals()!;
        const lang = this.language.currentLang();
        return [
            { label: 'V2.PANEL.KPI.REGISTRATIONS', icon: 'bi-people', value: t.registrations.toLocaleString() },
            { label: 'V2.PANEL.KPI.CHECKED_IN', icon: 'bi-check2-circle', value: t.checkedIn.toLocaleString() },
            { label: 'V2.PANEL.KPI.PAID', icon: 'bi-cash-coin', value: formatMoney(t.paidCents, lang) },
            { label: 'V2.PANEL.KPI.PENDING', icon: 'bi-hourglass-split', value: formatMoney(t.pendingCents, lang) },
        ];
    }
}
