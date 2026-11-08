import { Component, computed, effect, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { LanguageService } from '../../../core/services/language.service';
import { I18nPipe, formatEventDates, formatMoney } from '../../core/i18n';
import { ApiError } from '../../core/models';
import { AdminApiService } from '../admin-api.service';
import { ActivityItem, EventReport } from '../admin.models';
import { brandColor, fillDailyGaps, percent } from '../admin.utils';
import { EventContextService } from '../event-context.service';

const REFRESH_MS = 20_000;
const PALETTE = ['#16a34a', '#f59e0b', '#dc2626', '#94a3b8', '#0ea5e9'];

/** Resumen del evento: indicadores y gráficas (sin tablas de personas). */
@Component({
    selector: 'app-event-summary',
    standalone: true,
    imports: [TranslateModule, I18nPipe, NgApexchartsModule],
    template: `
    @if (context.current(); as event) {
      <div class="mb-4">
        <h1 class="page-title">{{ event.name | i18n }}</h1>
        <p class="page-subtitle">{{ dates() }}@if (event.venue) { · {{ event.venue }} }</p>
      </div>

      @if (report(); as r) {
        <div class="row g-3 mb-3">
          <div class="col-6 col-lg-3">
            <div class="panel-card kpi">
              <div class="kpi__label"><i class="bi bi-people"></i>{{ 'V2.PANEL.KPI.REGISTRATIONS' | translate }}</div>
              <div class="kpi__value">{{ r.totals.registrations.toLocaleString() }}</div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="panel-card kpi">
              <div class="kpi__label"><i class="bi bi-check2-circle"></i>{{ 'V2.PANEL.KPI.CHECKED_IN' | translate }}</div>
              <div class="kpi__value">{{ r.totals.checkedIn.toLocaleString() }}
                <span class="kpi__hint">{{ checkedInPercent() }}%</span></div>
              <div class="progress kpi__bar"><div class="progress-bar" [style.width.%]="checkedInPercent()"></div></div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="panel-card kpi">
              <div class="kpi__label"><i class="bi bi-cash-coin"></i>{{ 'V2.PANEL.KPI.PAID' | translate }}</div>
              <div class="kpi__value">{{ money(r.totals.paidCents) }}</div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="panel-card kpi">
              <div class="kpi__label"><i class="bi bi-hourglass-split"></i>{{ 'V2.PANEL.KPI.PENDING' | translate }}</div>
              <div class="kpi__value">{{ money(r.totals.pendingCents) }}</div>
            </div>
          </div>
        </div>

        @if (r.totals.registrations === 0) {
          <div class="panel-card text-center text-muted py-5">{{ 'V2.ADMIN.SUMMARY.EMPTY' | translate }}</div>
        } @else {
          <div class="row g-3 mb-3">
            <div class="col-12 col-xl-8">
              <div class="panel-card h-100">
                <h2 class="card-title">{{ 'V2.ADMIN.SUMMARY.DAILY' | translate }}</h2>
                <apx-chart [series]="daily().series" [chart]="daily().chart" [xaxis]="daily().xaxis" [stroke]="daily().stroke"
                           [fill]="daily().fill" [colors]="daily().colors" [dataLabels]="noLabels" [yaxis]="daily().yaxis"
                           [grid]="grid" [tooltip]="daily().tooltip"></apx-chart>
              </div>
            </div>
            <div class="col-12 col-md-6 col-xl-4">
              <div class="panel-card h-100">
                <h2 class="card-title">{{ 'V2.ADMIN.SUMMARY.PAYMENT_STATUS' | translate }}</h2>
                <apx-chart [series]="payment().series" [chart]="payment().chart" [labels]="payment().labels"
                           [colors]="payment().colors" [legend]="payment().legend" [dataLabels]="noLabels"
                           [plotOptions]="payment().plotOptions"></apx-chart>
              </div>
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-12 col-xl-8">
              <div class="panel-card h-100">
                <h2 class="card-title">{{ 'V2.ADMIN.SUMMARY.BY_CONFERENCE' | translate }}</h2>
                <apx-chart [series]="conference().series" [chart]="conference().chart" [xaxis]="conference().xaxis"
                           [plotOptions]="conference().plotOptions" [colors]="conference().colors" [dataLabels]="noLabels"
                           [legend]="conference().legend" [grid]="grid"></apx-chart>
              </div>
            </div>
            <div class="col-12 col-md-6 col-xl-4">
              <div class="panel-card h-100">
                <h2 class="card-title">{{ 'V2.ADMIN.SUMMARY.BY_METHOD' | translate }}</h2>
                @if (r.paymentsByMethod.length) {
                  <ul class="list-unstyled mb-0">
                    @for (m of r.paymentsByMethod; track m.method) {
                      <li class="row-line">
                        <span>{{ ('V2.ADMIN.METHOD.' + m.method) | translate }}
                          <small class="text-muted">· {{ m.payments }}</small></span>
                        <strong>{{ money(m.cents) }}</strong>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="text-muted small mb-0">{{ 'V2.ADMIN.SUMMARY.NO_PAYMENTS' | translate }}</p>
                }
              </div>
            </div>
          </div>

          <div class="row g-3">
            @for (a of r.answers; track a.key) {
              <div class="col-12 col-md-6 col-xl-4">
                <div class="panel-card h-100">
                  <h2 class="card-title">{{ a.label | i18n }}</h2>
                  @for (c of a.counts; track c.value) {
                    <div class="bar-line">
                      <div class="bar-line__head">
                        <span>{{ c.label ? (c.label | i18n) : c.value }}</span><span>{{ c.count }}</span>
                      </div>
                      <div class="progress"><div class="progress-bar" [style.width.%]="pct(c.count, r.totals.registrations)"></div></div>
                    </div>
                  }
                  @if (a.unanswered) {
                    <small class="text-muted">{{ 'V2.ADMIN.SUMMARY.UNANSWERED' | translate: { n: a.unanswered } }}</small>
                  }
                </div>
              </div>
            }
            <div class="col-12 col-md-6 col-xl-4">
              <div class="panel-card h-100">
                <h2 class="card-title">{{ 'V2.ADMIN.SUMMARY.ACTIVITY' | translate }}</h2>
                @if (activity().length === 0) {
                  <p class="text-muted small mb-0">{{ 'V2.ADMIN.SUMMARY.NO_ACTIVITY' | translate }}</p>
                }
                <ul class="list-unstyled mb-0">
                  @for (a of activity(); track a.id) {
                    <li class="activity">
                      <span class="activity__what"><strong>{{ a.registration.firstName }} {{ a.registration.lastName }}</strong>
                        {{ ('V2.ADMIN.ACTIVITY.' + a.action.replace('.', '_')) | translate }}</span>
                      <small class="text-muted">{{ time(a.at) }}@if (a.by) { · {{ a.by }} }</small>
                    </li>
                  }
                </ul>
              </div>
            </div>
          </div>
        }
      } @else if (error()) {
        <div class="alert alert-danger">{{ error()!.message }}</div>
      } @else {
        <p class="text-muted">{{ 'V2.COMMON.LOADING' | translate }}</p>
      }
    }
  `,
    styles: [`
    .kpi__label { font-size: 13px; color: var(--text-muted); display: flex; gap: 6px; align-items: center; }
    .kpi__value { font-size: 26px; font-weight: 700; margin-top: 6px; }
    .kpi__hint { font-size: 14px; font-weight: 600; color: var(--text-muted); margin-left: 6px; }
    .kpi__bar { height: 6px; margin-top: 8px; }
    .progress-bar { background: var(--brand-primary); }
    .card-title { font-size: 15px; font-weight: 600; margin: 0 0 12px; }
    .row-line { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
    .row-line:last-child { border-bottom: 0; }
    .bar-line { margin-bottom: 10px; font-size: 14px; }
    .bar-line__head { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .bar-line .progress { height: 6px; }
    .activity { display: flex; flex-direction: column; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
    .activity:last-child { border-bottom: 0; }
  `],
})
export class EventSummaryComponent {
    readonly context = inject(EventContextService);
    private api = inject(AdminApiService);
    private language = inject(LanguageService);
    private translate = inject(TranslateService);

    readonly report = signal<EventReport | null>(null);
    readonly activity = signal<ActivityItem[]>([]);
    readonly error = signal<ApiError | null>(null);
    private cursor = 0;

    readonly noLabels = { enabled: false };
    readonly grid = { borderColor: '#e2e8f0', strokeDashArray: 3 };

    readonly checkedInPercent = computed(() => {
        const t = this.report()?.totals;
        return t ? percent(t.checkedIn, t.registrations) : 0;
    });

    readonly daily = computed(() => {
        const days = fillDailyGaps(this.report()?.daily ?? []);
        return {
            series: [{ name: this.t('REGISTERED'), data: days.map(d => d.count) }],
            chart: { type: 'area' as const, height: 260, toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
            xaxis: { categories: days.map(d => d.date.slice(5)), labels: { rotate: 0, hideOverlappingLabels: true }, tickAmount: Math.min(days.length, 10) },
            yaxis: { min: 0, forceNiceScale: true, labels: { formatter: (v: number) => String(Math.round(v)) } },
            stroke: { curve: 'smooth' as const, width: 2 },
            fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.02 } },
            colors: [brandColor()],
            tooltip: { x: { formatter: (_: number, o: { dataPointIndex: number }) => days[o.dataPointIndex]?.date ?? '' } },
        };
    });

    readonly payment = computed(() => {
        const by = this.report()?.byPaymentStatus ?? {};
        const keys = ['paid', 'partially_paid', 'unpaid', 'not_required', 'refunded'].filter(k => by[k]);
        return {
            series: keys.map(k => by[k]),
            labels: keys.map(k => this.tr(`V2.ADMIN.PAYMENT_STATUS.${k}`)),
            colors: keys.map(k => ({ paid: PALETTE[0], partially_paid: PALETTE[1], unpaid: PALETTE[2], not_required: PALETTE[3], refunded: PALETTE[4] }[k] as string)),
            chart: { type: 'donut' as const, height: 260, fontFamily: 'inherit' },
            legend: { position: 'bottom' as const },
            plotOptions: { pie: { donut: { size: '62%' } } },
        };
    });

    readonly conference = computed(() => {
        const rows = (this.report()?.byConference ?? []).slice(0, 12);
        return {
            series: [
                { name: this.t('REGISTERED'), data: rows.map(r => r.registrations) },
                { name: this.t('CHECKED_IN_SERIES'), data: rows.map(r => r.checkedIn) },
            ],
            chart: { type: 'bar' as const, height: Math.max(220, rows.length * 44 + 60), toolbar: { show: false }, fontFamily: 'inherit' },
            plotOptions: { bar: { horizontal: true, barHeight: '70%', borderRadius: 3 } },
            xaxis: { categories: rows.map(r => r.shortName ?? r.name ?? '—'), labels: { formatter: (v: string) => String(Math.round(Number(v))) } },
            colors: [brandColor(), '#16a34a'],
            legend: { position: 'top' as const },
        };
    });

    private timer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Recarga al cambiar de evento y refresca la actividad mientras la pantalla está abierta
        effect((onCleanup) => {
            const id = this.context.currentEventId();
            if (!id) return;
            this.report.set(null);
            this.activity.set([]);
            this.error.set(null);
            this.cursor = 0;
            this.api.report(id).subscribe({
                next: r => this.report.set(r),
                error: (e: ApiError) => this.error.set(e),
            });
            this.loadActivity(id);
            this.timer = setInterval(() => this.loadActivity(id), REFRESH_MS);
            onCleanup(() => { if (this.timer) clearInterval(this.timer); });
        }, { allowSignalWrites: true });
    }

    private loadActivity(eventId: number) {
        this.api.activity(eventId, this.cursor || undefined).subscribe({
            next: res => {
                if (res.items.length) this.activity.update(list => [...res.items, ...list].slice(0, 15));
                this.cursor = Math.max(this.cursor, res.cursor);
            },
            error: () => undefined, // la actividad es un extra: si falla no se interrumpe el resumen
        });
    }

    /** Lee el idioma actual para que los datos de las gráficas se recalculen al cambiarlo. */
    private tr(key: string) { this.language.currentLang(); return this.translate.instant(key); }
    private t(key: string) { return this.tr(`V2.ADMIN.SUMMARY.${key}`); }
    pct = percent;
    money(cents: number) { return formatMoney(cents, this.language.currentLang()); }
    time(iso: string) {
        const tz = this.context.current()?.timezone;
        return new Intl.DateTimeFormat(this.language.currentLang() === 'es' ? 'es-MX' : 'en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz,
        }).format(new Date(iso));
    }

    dates() {
        const e = this.context.current();
        return e ? formatEventDates(e, this.language.currentLang()) : '';
    }
}
