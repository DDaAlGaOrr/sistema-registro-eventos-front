import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { LanguageService } from '../../../core/services/language.service';
import { CanDirective } from '../../core/can.directive';
import { I18nPipe, formatMoney } from '../../core/i18n';
import { ApiError } from '../../core/models';
import { PublicApiService } from '../../public/public-api.service';
import { ChurchOption } from '../../public/public.models';
import { AdminApiService, conferencesOf } from '../admin-api.service';
import {
    AuditEntry, FormItemsView, OrgNode, RegistrationDetail, RegistrationItemDetail, RegistrationUpdate,
} from '../admin.models';
import { PAYMENT_BADGE, STATUS_BADGE, formatAnswer } from '../admin.utils';

type Tab = 'data' | 'items' | 'payments' | 'history';

/**
 * Todo lo de un registro en un panel lateral: datos (editables), respuestas,
 * productos y entregas, pagos e historial. Es el único componente de edición
 * de registros: lo usan la lista de Registros y el Check-in.
 */
@Component({
    selector: 'app-registration-panel',
    standalone: true,
    imports: [ReactiveFormsModule, TranslateModule, I18nPipe, CanDirective],
    template: `
    <div class="rp__backdrop" (click)="closed.emit()"></div>
    <aside class="rp" role="dialog" aria-modal="true">
      <header class="rp__head">
        @if (detail(); as d) {
          <div class="min-w-0">
            <h2 class="rp__name">{{ d.firstName }} {{ d.lastName }}</h2>
            <div class="rp__sub">
              <code>{{ d.publicCode }}</code>
              <span class="badge {{ statusBadge[d.status] }}">{{ ('V2.ADMIN.STATUS.' + d.status) | translate }}</span>
              <span class="badge {{ paymentBadge[d.paymentStatus] }}">{{ ('V2.ADMIN.PAYMENT_STATUS.' + d.paymentStatus) | translate }}</span>
              @if (d.checkIn) { <span class="badge text-bg-primary"><i class="bi bi-check2"></i> {{ 'V2.ADMIN.REG.CHECKED_IN' | translate }}</span> }
              @if (d.deletedAt) { <span class="badge text-bg-dark">{{ 'V2.ADMIN.REG.DELETED' | translate }}</span> }
            </div>
          </div>
        }
        <button type="button" class="btn-close" [attr.aria-label]="'V2.COMMON.CLOSE' | translate" (click)="closed.emit()"></button>
      </header>

      @if (error()) {
        <div class="alert alert-danger m-3">{{ error()!.message }}
          <button type="button" class="btn btn-link btn-sm p-0 ms-2" (click)="load()">{{ 'V2.COMMON.RETRY' | translate }}</button></div>
      }

      @if (detail(); as d) {
        <div class="rp__actions">
          @if (!d.deletedAt) {
            <ng-container *appCan="'checkin.write'">
              @if (d.checkIn) {
                <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="busy()" (click)="run(api.undoCheckIn(d.id))">
                  <i class="bi bi-arrow-counterclockwise"></i> {{ 'V2.ADMIN.REG.UNDO_CHECKIN' | translate }}</button>
              } @else {
                <button type="button" class="btn btn-sm btn-brand" [disabled]="busy() || d.status === 'cancelled'" (click)="run(api.checkIn(d.id))">
                  <i class="bi bi-check2-circle"></i> {{ 'V2.ADMIN.REG.CHECKIN' | translate }}</button>
              }
            </ng-container>
            <ng-container *appCan="'registrations.delete'">
              <button type="button" class="btn btn-sm btn-outline-danger ms-auto" [disabled]="busy()" (click)="confirmingDelete.set(true)">
                <i class="bi bi-trash"></i> {{ 'V2.ADMIN.REG.DELETE' | translate }}</button>
            </ng-container>
          } @else {
            <ng-container *appCan="'registrations.delete'">
              <button type="button" class="btn btn-sm btn-outline-success" [disabled]="busy()" (click)="run(api.restoreRegistration(d.id))">
                <i class="bi bi-arrow-up-circle"></i> {{ 'V2.ADMIN.REG.RESTORE' | translate }}</button>
            </ng-container>
          }
        </div>
        @if (d.checkIn && !d.deletedAt) {
          <div class="rp__note"><i class="bi bi-check2-circle"></i>
            {{ 'V2.ADMIN.REG.CHECKED_IN_AT' | translate: { at: when(d.checkIn.at), by: d.checkIn.by ?? '—' } }}</div>
        }
        @if (confirmingDelete()) {
          <div class="rp__confirm">
            <p class="mb-2 fw-semibold">{{ 'V2.ADMIN.REG.DELETE_CONFIRM' | translate }}</p>
            <input class="form-control form-control-sm mb-2" maxlength="500" [placeholder]="'V2.ADMIN.REG.DELETE_REASON' | translate"
                   [value]="deleteReason()" (input)="deleteReason.set($any($event.target).value)" />
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-danger" [disabled]="busy()" (click)="doDelete()">{{ 'V2.ADMIN.REG.DELETE' | translate }}</button>
              <button type="button" class="btn btn-sm btn-light" (click)="confirmingDelete.set(false)">{{ 'V2.COMMON.CANCEL' | translate }}</button>
            </div>
          </div>
        }
        @if (actionError()) { <div class="alert alert-danger py-2 mx-3 mb-0">{{ actionError()!.message }}</div> }

        <ul class="nav nav-tabs rp__tabs">
          <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab() === 'data'" (click)="tab.set('data')">{{ 'V2.ADMIN.REG.TAB_DATA' | translate }}</button></li>
          <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab() === 'items'" (click)="openItems()">{{ 'V2.ADMIN.REG.TAB_ITEMS' | translate }}</button></li>
          <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab() === 'payments'" (click)="tab.set('payments')">{{ 'V2.ADMIN.REG.TAB_PAYMENTS' | translate }}</button></li>
          <ng-container *appCan="'audit.read'">
            <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab() === 'history'" (click)="openHistory()">{{ 'V2.ADMIN.REG.TAB_HISTORY' | translate }}</button></li>
          </ng-container>
        </ul>

        <div class="rp__body">
          @switch (tab()) {
            @case ('data') {
              @if (!editing()) {
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <h3 class="rp__h">{{ 'V2.ADMIN.REG.PERSONAL' | translate }}</h3>
                  @if (!d.deletedAt) {
                    <button *appCan="'registrations.update'" type="button" class="btn btn-sm btn-outline-secondary" (click)="startEdit()">
                      <i class="bi bi-pencil"></i> {{ 'V2.ADMIN.REG.EDIT' | translate }}</button>
                  }
                </div>
                <dl class="rp__dl">
                  <dt>{{ 'V2.ADMIN.REG.EMAIL' | translate }}</dt><dd>{{ d.email }}</dd>
                  <dt>{{ 'V2.ADMIN.REG.PHONE' | translate }}</dt><dd>{{ d.phone || '—' }}</dd>
                  <dt>{{ 'V2.ADMIN.REG.BIRTH' | translate }}</dt><dd>{{ d.birthDate || '—' }}</dd>
                  <dt>{{ 'V2.ADMIN.REG.GENDER' | translate }}</dt><dd>{{ d.gender ? (('V2.ADMIN.GENDER.' + d.gender) | translate) : '—' }}</dd>
                  <dt>{{ 'V2.ADMIN.REG.CONFERENCE' | translate }}</dt><dd>{{ d.conference?.name || '—' }}</dd>
                  <dt>{{ 'V2.ADMIN.REG.CHURCH' | translate }}</dt>
                  <dd>{{ d.church?.name || d.churchNameRaw || '—' }}
                    @if (d.church?.status === 'pending') { <span class="badge text-bg-warning ms-1">{{ 'V2.ADMIN.REG.CHURCH_PENDING' | translate }}</span> }</dd>
                  <dt>{{ 'V2.ADMIN.REG.REGISTERED_ON' | translate }}</dt><dd>{{ when(d.createdAt) }}</dd>
                </dl>

                @if (answerRows().length) {
                  <h3 class="rp__h mt-4">{{ 'V2.ADMIN.REG.ANSWERS' | translate }}</h3>
                  <dl class="rp__dl">
                    @for (row of answerRows(); track row.key) { <dt>{{ row.label }}</dt><dd>{{ row.value }}</dd> }
                  </dl>
                }
              } @else {
                <form [formGroup]="form" (ngSubmit)="save()" class="row g-3">
                  <div class="col-6"><label class="form-label">{{ 'V2.ADMIN.REG.FIRST_NAME' | translate }}</label>
                    <input class="form-control" formControlName="firstName" maxlength="100" /></div>
                  <div class="col-6"><label class="form-label">{{ 'V2.ADMIN.REG.LAST_NAME' | translate }}</label>
                    <input class="form-control" formControlName="lastName" maxlength="100" /></div>
                  <div class="col-12"><label class="form-label">{{ 'V2.ADMIN.REG.EMAIL' | translate }}</label>
                    <input class="form-control" type="email" formControlName="email" /></div>
                  <div class="col-6"><label class="form-label">{{ 'V2.ADMIN.REG.PHONE' | translate }}</label>
                    <input class="form-control" type="tel" formControlName="phone" maxlength="30" /></div>
                  <div class="col-6"><label class="form-label">{{ 'V2.ADMIN.REG.BIRTH' | translate }}</label>
                    <input class="form-control" type="date" formControlName="birthDate" /></div>
                  <div class="col-12"><label class="form-label">{{ 'V2.ADMIN.REG.GENDER' | translate }}</label>
                    <select class="form-select" formControlName="gender">
                      <option value="">—</option>
                      @for (g of genders; track g) { <option [value]="g">{{ ('V2.ADMIN.GENDER.' + g) | translate }}</option> }
                    </select></div>
                  <div class="col-12"><label class="form-label">{{ 'V2.ADMIN.REG.CONFERENCE' | translate }}</label>
                    <select class="form-select" formControlName="conferenceId" (change)="onConferenceChange()">
                      <option value="">—</option>
                      @for (c of conferences(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
                    </select></div>
                  <div class="col-12"><label class="form-label">{{ 'V2.ADMIN.REG.CHURCH' | translate }}</label>
                    <select class="form-select" formControlName="churchId">
                      <option value="">—</option>
                      @for (c of churches(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
                    </select></div>
                  @if (formError()) { <div class="col-12"><div class="alert alert-danger py-2 mb-0">{{ formError()!.message }}</div></div> }
                  <div class="col-12 d-flex gap-2">
                    <button type="submit" class="btn btn-brand" [disabled]="busy() || form.invalid">{{ 'V2.ADMIN.REG.SAVE' | translate }}</button>
                    <button type="button" class="btn btn-light" (click)="editing.set(false)">{{ 'V2.COMMON.CANCEL' | translate }}</button>
                  </div>
                </form>
              }
            }

            @case ('items') {
              <ul class="list-unstyled mb-0">
                @for (it of d.items; track it.id) {
                  <li class="rp__item">
                    <div class="d-flex justify-content-between gap-2">
                      <div>
                        <strong>{{ it.name | i18n }}</strong>@if (it.variant) { <span class="text-muted"> · {{ it.variant.label | i18n }}</span> }
                        <div class="small text-muted">{{ money(it.unitPriceCents) }} ·
                          <span class="badge {{ itemBadge(it.paymentStatus) }}">{{ ('V2.ADMIN.PAYMENT_STATUS.' + it.paymentStatus) | translate }}</span></div>
                      </div>
                      @if (it.kind === 'product' && !d.deletedAt) {
                        <div class="text-end">
                          <ng-container *appCan="'checkin.write'">
                            @if (it.deliveredAt) {
                              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="busy()" (click)="run(api.setDelivered(d.id, it.id, false))">
                                {{ 'V2.ADMIN.REG.UNDO_DELIVERY' | translate }}</button>
                            } @else {
                              <button type="button" class="btn btn-sm btn-outline-success" [disabled]="busy() || it.paymentStatus === 'unpaid'"
                                      [title]="it.paymentStatus === 'unpaid' ? ('V2.ADMIN.REG.PAY_FIRST' | translate) : ''" (click)="run(api.setDelivered(d.id, it.id, true))">
                                <i class="bi bi-box-seam"></i> {{ 'V2.ADMIN.REG.DELIVER' | translate }}</button>
                            }
                          </ng-container>
                        </div>
                      }
                    </div>
                    @if (it.deliveredAt) {
                      <div class="small text-success mt-1"><i class="bi bi-check2"></i>
                        {{ 'V2.ADMIN.REG.DELIVERED_AT' | translate: { at: when(it.deliveredAt), by: it.deliveredBy ?? '—' } }}</div>
                    }
                    @if (canChangeVariant(it) && variantsOf(it).length > 1) {
                      <div class="mt-2" *appCan="'registrations.update'">
                        <select class="form-select form-select-sm" [disabled]="busy()" (change)="changeVariant(it, $any($event.target).value)">
                          @for (v of variantsOf(it); track v.code) {
                            <option [value]="v.code" [selected]="v.code === it.variant?.code">{{ v.label | i18n }}</option>
                          }
                        </select>
                      </div>
                    }
                  </li>
                } @empty { <p class="text-muted mb-0">{{ 'V2.ADMIN.REG.NO_ITEMS' | translate }}</p> }
              </ul>
              <div class="rp__total">
                <span>{{ 'V2.ADMIN.REG.TOTAL' | translate }}</span><strong>{{ money(d.totalCents) }}</strong>
              </div>
            }

            @case ('payments') {
              <div class="rp__total mt-0 mb-3">
                <span>{{ 'V2.ADMIN.REG.PAID' | translate }}</span>
                <strong>{{ money(d.paidCents) }} / {{ money(d.totalCents) }}</strong>
              </div>
              <ul class="list-unstyled mb-0">
                @for (p of d.payments; track p.id) {
                  <li class="rp__item">
                    <div class="d-flex justify-content-between">
                      <strong>{{ ('V2.ADMIN.METHOD.' + p.method) | translate }}</strong><strong>{{ money(p.amountCents) }}</strong>
                    </div>
                    <div class="small text-muted">
                      {{ ('V2.ADMIN.PAYMENT_ROW.' + p.status) | translate }}@if (p.paidAt) { · {{ when(p.paidAt) }} }@if (p.recordedBy) { · {{ p.recordedBy }} }
                      @if (p.refundedCents) { · {{ 'V2.ADMIN.REG.REFUNDED' | translate: { amount: money(p.refundedCents) } }} }
                    </div>
                    @if (p.reference || p.notes) { <div class="small">{{ p.reference }} {{ p.notes }}</div> }
                  </li>
                } @empty { <p class="text-muted mb-0">{{ 'V2.ADMIN.REG.NO_PAYMENTS' | translate }}</p> }
              </ul>
            }

            @case ('history') {
              @if (history() === null) {
                <p class="text-muted">{{ 'V2.COMMON.LOADING' | translate }}</p>
              } @else {
                <ul class="list-unstyled mb-0">
                  @for (h of history(); track h.id) {
                    <li class="rp__item">
                      <div class="d-flex justify-content-between gap-2">
                        <strong>{{ actionLabel(h.action) }}</strong><small class="text-muted text-nowrap">{{ when(h.createdAt) }}</small>
                      </div>
                      <div class="small text-muted">{{ h.actor.name || ('V2.ADMIN.REG.SYSTEM' | translate) }}</div>
                    </li>
                  } @empty { <p class="text-muted mb-0">{{ 'V2.ADMIN.REG.NO_HISTORY' | translate }}</p> }
                </ul>
              }
            }
          }
        </div>
      } @else if (!error()) {
        <p class="text-muted p-3">{{ 'V2.COMMON.LOADING' | translate }}</p>
      }
    </aside>
  `,
    styles: [`
    :host { display: contents; }
    .rp__backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .4); z-index: 1050; }
    .rp {
      position: fixed; top: 0; right: 0; height: 100vh; width: min(520px, 100vw); z-index: 1051;
      background: var(--surface); box-shadow: -8px 0 30px rgba(15, 23, 42, .15);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .rp__head { display: flex; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .rp__name { font-size: 19px; font-weight: 700; margin: 0; }
    .rp__sub { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 6px; font-size: 13px; }
    .rp__actions { display: flex; gap: 8px; padding: 12px 20px; border-bottom: 1px solid var(--border); }
    .rp__note { padding: 8px 20px; font-size: 13px; color: #0f766e; background: #f0fdfa; border-bottom: 1px solid var(--border); }
    .rp__confirm { padding: 12px 20px; background: #fef2f2; border-bottom: 1px solid #fecaca; }
    .rp__tabs { padding: 0 12px; margin-top: 8px; flex-wrap: nowrap; overflow-x: auto; }
    .rp__tabs .nav-link { font-size: 14px; white-space: nowrap; }
    .rp__tabs .nav-link.active { color: var(--brand-primary); border-bottom-color: var(--brand-primary); font-weight: 600; }
    .rp__body { padding: 16px 20px 32px; overflow-y: auto; flex: 1; }
    .rp__h { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 0; }
    .rp__dl { display: grid; grid-template-columns: 38% 1fr; gap: 8px 12px; margin: 10px 0 0; font-size: 14px; }
    .rp__dl dt { color: var(--text-muted); font-weight: 500; }
    .rp__dl dd { margin: 0; word-break: break-word; }
    .rp__item { padding: 10px 0; border-bottom: 1px solid var(--border); }
    .rp__item:last-child { border-bottom: 0; }
    .rp__total { display: flex; justify-content: space-between; margin-top: 14px; padding-top: 12px; border-top: 2px solid var(--border); }
    .min-w-0 { min-width: 0; }
  `],
})
export class RegistrationPanelComponent implements OnChanges {
    @Input({ required: true }) registrationId!: number;
    @Input() timezone: string | undefined;
    /** Se abre desde la papelera (solo quien puede borrar puede pedir registros borrados). */
    @Input() includeDeleted = false;
    @Output() closed = new EventEmitter<void>();
    /** Algo cambió (check-in, edición, borrado…): la lista debe refrescarse. */
    @Output() changed = new EventEmitter<RegistrationDetail>();

    readonly api = inject(AdminApiService);
    private publicApi = inject(PublicApiService);
    private language = inject(LanguageService);
    private translate = inject(TranslateService);
    private fb = inject(FormBuilder);

    readonly statusBadge = STATUS_BADGE;
    readonly paymentBadge = PAYMENT_BADGE;
    readonly genders = ['male', 'female', 'undisclosed'] as const;

    readonly detail = signal<RegistrationDetail | null>(null);
    readonly error = signal<ApiError | null>(null);
    readonly actionError = signal<ApiError | null>(null);
    readonly formError = signal<ApiError | null>(null);
    readonly busy = signal(false);
    readonly tab = signal<Tab>('data');
    readonly editing = signal(false);
    readonly confirmingDelete = signal(false);
    readonly deleteReason = signal('');
    readonly history = signal<AuditEntry[] | null>(null);
    readonly formItems = signal<FormItemsView | null>(null);
    readonly conferences = signal<OrgNode[]>([]);
    readonly churches = signal<ChurchOption[]>([]);

    readonly form = this.fb.nonNullable.group({
        firstName: '', lastName: '', email: '', phone: '', birthDate: '', gender: '', conferenceId: '', churchId: '',
    });

    readonly answerRows = computed(() => {
        const d = this.detail();
        if (!d) return [];
        this.language.currentLang();
        const yes = this.translate.instant('V2.ADMIN.YES');
        const no = this.translate.instant('V2.ADMIN.NO');
        const lang = this.language.currentLang();
        // "state" lo agrega el sistema (ya se ve en Asociación)
        return Object.entries(d.answers).filter(([key]) => key !== 'state').map(([key, value]) => {
            const options = d.answerOptions?.[key];
            const labelOf = options
                ? (v: unknown) => options.find(o => JSON.stringify(o.value) === JSON.stringify(v) || String(o.value) === String(v))?.label[lang]
                : undefined;
            return { key, label: d.answerLabels[key]?.[lang] ?? key, value: formatAnswer(value, yes, no, labelOf) };
        });
    });

    constructor() {
        this.api.organizationTree().subscribe({ next: tree => this.conferences.set(conferencesOf(tree)), error: () => undefined });
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['registrationId']) {
            this.detail.set(null);
            this.history.set(null);
            this.formItems.set(null);
            this.tab.set('data');
            this.editing.set(false);
            this.confirmingDelete.set(false);
            this.actionError.set(null);
            this.load();
        }
    }

    load() {
        this.error.set(null);
        this.api.registration(this.registrationId, this.includeDeleted).subscribe({
            next: d => this.detail.set(d),
            error: (e: ApiError) => this.error.set(e),
        });
    }

    money(cents: number) { return formatMoney(cents, this.language.currentLang()); }

    when(iso: string | Date) {
        return new Intl.DateTimeFormat(this.language.currentLang() === 'es' ? 'es-MX' : 'en-US', {
            dateStyle: 'medium', timeStyle: 'short', timeZone: this.timezone,
        }).format(new Date(iso));
    }

    itemBadge(status: string) { return (PAYMENT_BADGE as Record<string, string>)[status] ?? 'text-bg-secondary'; }

    actionLabel(action: string) {
        const key = `V2.ADMIN.AUDIT_ACTION.${action.replace(/\./g, '_')}`;
        const text = this.translate.instant(key);
        return text === key ? action : text;
    }

    // ── Acciones ──────────────────────────────────────────────────────

    /** Ejecuta una acción que devuelve el registro actualizado. */
    run(request: Observable<unknown>) {
        this.busy.set(true);
        this.actionError.set(null);
        request.subscribe({
            next: () => this.refresh(),
            error: (e: ApiError) => { this.busy.set(false); this.actionError.set(e); },
        });
    }

    /** Vuelve a pedir el registro completo (cada acción de la API responde con un resumen distinto). */
    private refresh() {
        const id = this.registrationId;
        this.api.registration(id, this.includeDeleted || !!this.detail()?.deletedAt).subscribe({
            next: d => this.applied(d),
            error: (e: ApiError) => { this.busy.set(false); this.actionError.set(e); },
        });
    }

    private applied(d: RegistrationDetail) {
        this.busy.set(false);
        this.detail.set(d);
        this.history.set(null);
        this.changed.emit(d);
    }

    doDelete() {
        const d = this.detail();
        if (!d) return;
        this.busy.set(true);
        this.actionError.set(null);
        this.api.deleteRegistration(d.id, this.deleteReason().trim() || null).subscribe({
            next: () => {
                this.confirmingDelete.set(false);
                this.deleteReason.set('');
                this.api.registration(d.id, true).subscribe({ next: x => this.applied(x), error: () => { this.busy.set(false); this.closed.emit(); } });
            },
            error: (e: ApiError) => { this.busy.set(false); this.actionError.set(e); },
        });
    }

    // ── Edición ───────────────────────────────────────────────────────

    startEdit() {
        const d = this.detail()!;
        this.formError.set(null);
        this.form.setValue({
            firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone ?? '', birthDate: d.birthDate ?? '',
            gender: d.gender ?? '', conferenceId: d.conference ? String(d.conference.id) : '', churchId: d.church ? String(d.church.id) : '',
        });
        this.loadChurches(d.conference?.id ?? null, d.church);
        this.editing.set(true);
    }

    onConferenceChange() {
        this.form.patchValue({ churchId: '' });
        const id = Number(this.form.controls.conferenceId.value) || null;
        this.loadChurches(id, null);
    }

    private loadChurches(conferenceId: number | null, current: { id: number; name: string } | null) {
        this.churches.set(current ? [{ id: current.id, name: current.name, city: null }] : []);
        if (!conferenceId) return;
        this.publicApi.churches(conferenceId).subscribe({
            next: list => {
                // La iglesia actual puede estar pendiente de aprobar y no salir en la lista pública
                const withCurrent = current && !list.some(c => c.id === current.id) ? [{ id: current.id, name: current.name, city: null }, ...list] : list;
                this.churches.set(withCurrent);
            },
            error: () => undefined,
        });
    }

    save() {
        const d = this.detail()!;
        const v = this.form.getRawValue();
        const changes: RegistrationUpdate = {};
        if (v.firstName.trim() !== d.firstName) changes.firstName = v.firstName.trim();
        if (v.lastName.trim() !== d.lastName) changes.lastName = v.lastName.trim();
        if (v.email.trim().toLowerCase() !== d.email) changes.email = v.email.trim();
        if ((v.phone.trim() || null) !== d.phone) changes.phone = v.phone.trim() || null;
        if ((v.birthDate || null) !== d.birthDate) changes.birthDate = v.birthDate || null;
        if ((v.gender || null) !== d.gender) changes.gender = (v.gender || null) as RegistrationUpdate['gender'];
        const conferenceId = Number(v.conferenceId) || null;
        const churchId = Number(v.churchId) || null;
        if (conferenceId !== (d.conference?.id ?? null)) changes.conferenceOrganizationId = conferenceId;
        if (churchId !== (d.church?.id ?? null)) changes.churchOrganizationId = churchId;
        if (!Object.keys(changes).length) { this.editing.set(false); return; }

        this.busy.set(true);
        this.formError.set(null);
        this.api.updateRegistration(d.id, changes).subscribe({
            next: () => { this.editing.set(false); this.refresh(); },
            error: (e: ApiError) => { this.busy.set(false); this.formError.set(e); },
        });
    }

    // ── Productos e historial ─────────────────────────────────────────

    openItems() {
        this.tab.set('items');
        const d = this.detail();
        if (d && !this.formItems()) this.api.formItems(d.formId).subscribe({ next: f => this.formItems.set(f), error: () => undefined });
    }

    openHistory() {
        this.tab.set('history');
        if (this.history() === null) {
            this.api.history(this.registrationId).subscribe({ next: h => this.history.set(h), error: () => this.history.set([]) });
        }
    }

    variantsOf(item: RegistrationItemDetail) {
        return this.formItems()?.items.find(i => i.id === item.itemId)?.variants.filter(v => v.isActive || v.code === item.variant?.code) ?? [];
    }

    canChangeVariant(item: RegistrationItemDetail) {
        return item.kind === 'product' && !!item.variant && !item.deliveredAt && !this.detail()?.deletedAt;
    }

    changeVariant(item: RegistrationItemDetail, variantCode: string) {
        const d = this.detail();
        if (!d || variantCode === item.variant?.code) return;
        this.run(this.api.changeVariant(d.id, item.id, variantCode));
    }
}
