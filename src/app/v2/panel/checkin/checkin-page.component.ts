import { Component, computed, effect, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { LanguageService } from '../../../core/services/language.service';
import { I18nPipe, formatMoney } from '../../core/i18n';
import { ApiError } from '../../core/models';
import { AdminApiService } from '../admin-api.service';
import { CheckinSummary, RegistrationListItem } from '../admin.models';
import { PAYMENT_BADGE, extractPublicCode, feedback } from '../admin.utils';
import { EventContextService } from '../event-context.service';
import { RegistrationPanelComponent } from '../registrations/registration-panel.component';
import { QrScannerComponent } from './qr-scanner.component';

type Mode = 'scan' | 'search';
const SEARCH_DELAY_MS = 350;

/**
 * Check-in en la puerta (pensado para celular): escanear el QR o buscar por nombre,
 * ver qué debe y qué le toca, registrar la entrada y entregar productos.
 */
@Component({
    selector: 'app-checkin-page',
    standalone: true,
    imports: [TranslateModule, I18nPipe, QrScannerComponent, RegistrationPanelComponent],
    template: `
    <div class="ck">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 class="page-title">{{ 'V2.PANEL.MENU.CHECKIN' | translate }}</h1>
          @if (counter(); as c) {
            <p class="page-subtitle">{{ 'V2.ADMIN.CHECKIN.COUNTER' | translate: { done: c.done, total: c.total } }}</p>
          }
        </div>
      </div>

      @if (error()) { <div class="alert alert-danger" role="alert">{{ error()!.message }}</div> }

      @if (summary(); as s) {
        <!-- ── Ficha de la persona ── -->
        <div class="panel-card ck__card">
          @if (result() === 'checked_in') {
            <div class="ck__banner ck__banner--ok"><i class="bi bi-check-circle-fill"></i> {{ 'V2.ADMIN.CHECKIN.OK' | translate }}</div>
          } @else if (s.status === 'cancelled') {
            <div class="ck__banner ck__banner--bad"><i class="bi bi-x-octagon-fill"></i> {{ 'V2.ADMIN.CHECKIN.CANCELLED' | translate }}</div>
          } @else if (s.checkIn) {
            <div class="ck__banner ck__banner--warn"><i class="bi bi-exclamation-triangle-fill"></i>
              {{ 'V2.ADMIN.CHECKIN.ALREADY' | translate: { at: when(s.checkIn.at), by: s.checkIn.by ?? '—' } }}</div>
          }

          <h2 class="ck__name">{{ s.firstName }} {{ s.lastName }}</h2>
          <div class="text-muted">{{ s.conference?.name }}@if (s.church) { · {{ s.church.name }} }</div>
          <div class="mt-2 d-flex flex-wrap gap-2 align-items-center">
            <code>{{ s.publicCode }}</code>
            <span class="badge {{ paymentBadge[s.paymentStatus] }}">{{ ('V2.ADMIN.PAYMENT_STATUS.' + s.paymentStatus) | translate }}</span>
          </div>

          @if (s.pendingCents > 0) {
            <div class="ck__owes"><i class="bi bi-cash-coin"></i>
              <div><strong>{{ 'V2.ADMIN.CHECKIN.OWES' | translate: { amount: money(s.pendingCents) } }}</strong>
                <div class="small">{{ 'V2.ADMIN.CHECKIN.OWES_HINT' | translate }}</div></div>
            </div>
          }

          @if (s.items.length) {
            <h3 class="ck__h">{{ 'V2.ADMIN.CHECKIN.ITEMS' | translate }}</h3>
            <ul class="list-unstyled mb-0">
              @for (it of s.items; track it.id) {
                <li class="ck__item">
                  <div>
                    <strong>{{ it.name | i18n }}</strong>@if (it.variant) { <span class="text-muted"> · {{ it.variant.label | i18n }}</span> }
                    @if (it.deliveredAt) { <div class="small text-success"><i class="bi bi-check2"></i> {{ 'V2.ADMIN.CHECKIN.DELIVERED' | translate }}</div> }
                    @else if (it.paymentStatus === 'unpaid') { <div class="small text-danger">{{ 'V2.ADMIN.PAYMENT_STATUS.unpaid' | translate }}</div> }
                  </div>
                  @if (it.deliveredAt) {
                    <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="busy()" (click)="act(api.setDelivered(s.id, it.id, false))">
                      {{ 'V2.ADMIN.REG.UNDO_DELIVERY' | translate }}</button>
                  } @else {
                    <button type="button" class="btn btn-sm btn-outline-success" [disabled]="busy() || it.paymentStatus === 'unpaid'"
                            [title]="it.paymentStatus === 'unpaid' ? ('V2.ADMIN.REG.PAY_FIRST' | translate) : ''" (click)="act(api.setDelivered(s.id, it.id, true))">
                      <i class="bi bi-box-seam"></i> {{ 'V2.ADMIN.REG.DELIVER' | translate }}</button>
                  }
                </li>
              }
            </ul>
          }

          <div class="ck__actions">
            @if (!s.checkIn && s.status !== 'cancelled') {
              <button type="button" class="btn btn-brand btn-lg" [disabled]="busy()" (click)="checkIn(s)">
                <i class="bi bi-box-arrow-in-right"></i> {{ 'V2.ADMIN.CHECKIN.CHECK_IN' | translate }}</button>
            }
            <button type="button" class="btn btn-lg" [class.btn-outline-secondary]="!s.checkIn" [class.btn-brand]="!!s.checkIn" (click)="next()">
              {{ 'V2.ADMIN.CHECKIN.NEXT' | translate }}</button>
            <button type="button" class="btn btn-link" (click)="showFull.set(true)">{{ 'V2.ADMIN.CHECKIN.FULL_RECORD' | translate }}</button>
          </div>
        </div>
      } @else {
        <ul class="nav nav-pills ck__modes mb-3">
          <li class="nav-item"><button type="button" class="nav-link" [class.active]="mode() === 'scan'" (click)="setMode('scan')">
            <i class="bi bi-qr-code-scan"></i> {{ 'V2.ADMIN.CHECKIN.TAB_SCAN' | translate }}</button></li>
          <li class="nav-item"><button type="button" class="nav-link" [class.active]="mode() === 'search'" (click)="setMode('search')">
            <i class="bi bi-search"></i> {{ 'V2.ADMIN.CHECKIN.TAB_SEARCH' | translate }}</button></li>
        </ul>

        @if (mode() === 'scan') {
          <app-qr-scanner [active]="cameraOn() && !busy()" (decoded)="onScanned($event)" />
          <div class="text-center mt-3">
            <button type="button" class="btn" [class.btn-brand]="!cameraOn()" [class.btn-outline-secondary]="cameraOn()" (click)="cameraOn.set(!cameraOn())">
              <i class="bi" [class.bi-camera-video]="!cameraOn()" [class.bi-camera-video-off]="cameraOn()"></i>
              {{ (cameraOn() ? 'V2.ADMIN.CHECKIN.CAMERA_STOP' : 'V2.ADMIN.CHECKIN.CAMERA_START') | translate }}</button>
            <p class="text-muted small mt-2 mb-0">{{ 'V2.ADMIN.CHECKIN.POINT' | translate }}</p>
          </div>
          <form class="ck__code" (submit)="$event.preventDefault(); onScanned(codeText())">
            <label class="form-label small text-muted">{{ 'V2.ADMIN.CHECKIN.OR_CODE' | translate }}</label>
            <div class="input-group">
              <input class="form-control" autocapitalize="characters" autocomplete="off" spellcheck="false"
                     [placeholder]="'V2.ADMIN.CHECKIN.CODE_PLACEHOLDER' | translate" [value]="codeText()" (input)="codeText.set($any($event.target).value)" />
              <button class="btn btn-outline-secondary" type="submit" [disabled]="busy() || !codeText().trim()">{{ 'V2.ADMIN.CHECKIN.LOOKUP' | translate }}</button>
            </div>
          </form>
        } @else {
          <input type="search" class="form-control form-control-lg mb-3" [placeholder]="'V2.ADMIN.CHECKIN.SEARCH_PLACEHOLDER' | translate"
                 [value]="searchText()" (input)="onSearch($any($event.target).value)" />
          <ul class="list-unstyled mb-0">
            @for (r of results(); track r.id) {
              <li>
                <button type="button" class="ck__result" (click)="pick(r)">
                  <div>
                    <strong>{{ r.lastName }}, {{ r.firstName }}</strong>
                    <div class="small text-muted">{{ r.conference?.shortName }}@if (r.church?.name || r.churchNameRaw) { · {{ r.church?.name || r.churchNameRaw }} }</div>
                  </div>
                  @if (r.checkedInAt) { <i class="bi bi-check-circle-fill text-success fs-5"></i> }
                  @else { <span class="badge {{ paymentBadge[r.paymentStatus] }}">{{ ('V2.ADMIN.PAYMENT_STATUS.' + r.paymentStatus) | translate }}</span> }
                </button>
              </li>
            } @empty {
              @if (searchText().trim().length >= 2 && !searching()) {
                <p class="text-muted text-center py-4 mb-0">{{ 'V2.ADMIN.CHECKIN.NO_RESULTS' | translate }}</p>
              }
            }
          </ul>
        }
      }
    </div>

    @if (showFull() && summary(); as s) {
      <app-registration-panel [registrationId]="s.id" [timezone]="context.current()?.timezone"
                              (closed)="showFull.set(false)" (changed)="refreshSummary()" />
    }
  `,
    styles: [`
    .ck { max-width: 560px; margin: 0 auto; }
    .ck__modes .nav-link { color: var(--text); }
    .ck__modes .nav-link.active { background: var(--brand-primary); color: #fff; }
    .ck__code { margin-top: 20px; }
    .ck__card { padding: 20px; }
    .ck__banner { display: flex; gap: 10px; align-items: center; padding: 12px 14px; border-radius: 10px; font-weight: 600; margin-bottom: 14px; }
    .ck__banner--ok { background: #dcfce7; color: #166534; }
    .ck__banner--warn { background: #fef3c7; color: #92400e; }
    .ck__banner--bad { background: #fee2e2; color: #991b1b; }
    .ck__name { font-size: 24px; font-weight: 700; margin: 0 0 2px; }
    .ck__owes { display: flex; gap: 12px; align-items: flex-start; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412;
      padding: 12px 14px; border-radius: 10px; margin-top: 14px; }
    .ck__owes .bi { font-size: 22px; }
    .ck__h { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 18px 0 6px; }
    .ck__item { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .ck__item:last-child { border-bottom: 0; }
    .ck__actions { display: flex; flex-direction: column; gap: 8px; margin-top: 20px; }
    .ck__result { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; text-align: left; cursor: pointer;
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; margin-bottom: 8px; font: inherit; }
    .ck__result:hover { border-color: var(--brand-primary); }
  `],
})
export class CheckinPageComponent {
    readonly context = inject(EventContextService);
    readonly api = inject(AdminApiService);
    private language = inject(LanguageService);

    readonly paymentBadge = PAYMENT_BADGE;
    readonly mode = signal<Mode>('scan');
    readonly cameraOn = signal(false);
    readonly busy = signal(false);
    readonly error = signal<ApiError | null>(null);
    readonly summary = signal<CheckinSummary | null>(null);
    readonly result = signal<'checked_in' | 'already_checked_in' | null>(null);
    readonly showFull = signal(false);
    readonly codeText = signal('');
    readonly searchText = signal('');
    readonly results = signal<RegistrationListItem[]>([]);
    readonly searching = signal(false);
    readonly totals = signal<{ registrations: number; checkedIn: number } | null>(null);

    readonly counter = computed(() => {
        const t = this.totals();
        return t ? { done: t.checkedIn, total: t.registrations } : null;
    });

    private searchTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        effect(() => {
            const id = this.context.currentEventId();
            if (!id) return;
            this.summary.set(null);
            this.loadTotals(id);
        }, { allowSignalWrites: true });
    }

    private get eventId() { return this.context.currentEventId(); }

    private loadTotals(eventId: number) {
        this.api.report(eventId).subscribe({ next: r => this.totals.set(r.totals), error: () => undefined });
    }

    setMode(mode: Mode) {
        this.mode.set(mode);
        this.error.set(null);
        if (mode === 'search') this.cameraOn.set(false);
    }

    // ── Buscar a la persona ───────────────────────────────────────────

    /** Texto leído del QR (o escrito a mano): saca el código y busca la ficha. */
    onScanned(text: string) {
        const code = extractPublicCode(text);
        if (!code) { this.fail({ status: 400, message: this.language.currentLang() === 'es' ? 'Ese QR no es un código de registro.' : 'That QR is not a registration code.' }); return; }
        this.lookup(code);
    }

    private lookup(code: string) {
        const eventId = this.eventId;
        if (!eventId || this.busy()) return;
        this.busy.set(true);
        this.error.set(null);
        this.api.checkinLookup(eventId, code).subscribe({
            next: s => { this.busy.set(false); this.result.set(null); this.summary.set(s); feedback(s.status === 'cancelled' || !!s.checkIn ? 'warn' : 'ok'); },
            error: (e: ApiError) => { this.busy.set(false); this.fail(e); },
        });
    }

    onSearch(text: string) {
        this.searchText.set(text);
        if (this.searchTimer) clearTimeout(this.searchTimer);
        const q = text.trim();
        if (q.length < 2) { this.results.set([]); return; }
        this.searchTimer = setTimeout(() => this.search(q), SEARCH_DELAY_MS);
    }

    private search(q: string) {
        const eventId = this.eventId;
        if (!eventId) return;
        this.searching.set(true);
        this.api.registrations(eventId, { q }, { page: 1, pageSize: 12, sort: 'last_name', order: 'asc' }).subscribe({
            next: page => { this.results.set(page.items); this.searching.set(false); },
            error: (e: ApiError) => { this.searching.set(false); this.error.set(e); },
        });
    }

    pick(r: RegistrationListItem) { this.lookup(r.publicCode); }

    // ── Acciones sobre la ficha ───────────────────────────────────────

    checkIn(s: CheckinSummary) {
        const eventId = this.eventId;
        if (!eventId) return;
        this.busy.set(true);
        this.error.set(null);
        this.api.checkinByCode(eventId, s.publicCode).subscribe({
            next: res => {
                this.busy.set(false);
                this.summary.set(res.registration);
                this.result.set(res.result);
                feedback(res.result === 'checked_in' ? 'ok' : 'warn');
                this.loadTotals(eventId);
            },
            error: (e: ApiError) => { this.busy.set(false); this.fail(e); },
        });
    }

    /** Entregar o deshacer una entrega y refrescar la ficha. */
    act(request: Observable<unknown>) {
        this.busy.set(true);
        this.error.set(null);
        request.subscribe({
            next: () => { this.busy.set(false); this.refreshSummary(); },
            error: (e: ApiError) => { this.busy.set(false); this.fail(e); },
        });
    }

    refreshSummary() {
        const s = this.summary();
        const eventId = this.eventId;
        if (!s || !eventId) return;
        this.api.checkinLookup(eventId, s.publicCode).subscribe({
            next: fresh => this.summary.set(fresh),
            error: (e: ApiError) => this.fail(e),
        });
        this.loadTotals(eventId);
    }

    /** Listo para la siguiente persona. */
    next() {
        this.summary.set(null);
        this.result.set(null);
        this.showFull.set(false);
        this.codeText.set('');
        this.error.set(null);
    }

    private fail(e: ApiError) {
        this.error.set(e);
        feedback('error');
    }

    money(cents: number) { return formatMoney(cents, this.language.currentLang()); }

    when(iso: string) {
        return new Intl.DateTimeFormat(this.language.currentLang() === 'es' ? 'es-MX' : 'en-US', {
            dateStyle: 'medium', timeStyle: 'short', timeZone: this.context.current()?.timezone,
        }).format(new Date(iso));
    }
}
