import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { LanguageService } from '../../../core/services/language.service';
import { CanDirective } from '../../core/can.directive';
import { I18nPipe, formatMoney } from '../../core/i18n';
import { ApiError } from '../../core/models';
import { AdminApiService } from '../admin-api.service';
import { ManualMethod, RegistrationDetail, RegistrationPayment } from '../admin.models';

type Action = { kind: 'void' | 'refund'; paymentId: number } | null;

const METHODS: ManualMethod[] = ['cash', 'check', 'zelle', 'other'];

/** "12.50" → 1250 (centavos); null si no es un monto válido. */
export function parseDollars(text: string): number | null {
    const clean = text.trim().replace(/^\$/, '').replace(/,/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
    return Math.round(Number(clean) * 100);
}

/**
 * Pagos de un registro: lo cobrado y lo pendiente, registrar un pago manual
 * (efectivo, cheque, Zelle), anular un pago manual o reembolsar.
 * La API vuelve a revisar el permiso y las reglas de cada acción.
 */
@Component({
    selector: 'app-registration-payments',
    standalone: true,
    imports: [FormsModule, TranslateModule, I18nPipe, CanDirective],
    template: `
    <div class="rpay__total">
      <span>{{ 'V2.ADMIN.REG.PAID' | translate }}</span>
      <strong>{{ money(detail.paidCents) }} / {{ money(detail.totalCents) }}</strong>
    </div>

    @if (error()) { <div class="alert alert-danger py-2">{{ error()!.message }}</div> }

    <ng-container *appCan="'payments.write'">
      @if (unpaidItems().length && !detail.deletedAt && detail.status !== 'cancelled') {
        @if (!recording()) {
          <button type="button" class="btn btn-brand w-100 mb-3" (click)="startRecording()">
            <i class="bi bi-cash-coin"></i> {{ 'V2.ADMIN.PAY.RECORD' | translate }} · {{ money(pendingCents()) }}</button>
        } @else {
          <form class="rpay__form" (ngSubmit)="submitPayment()">
            <h3 class="rpay__h">{{ 'V2.ADMIN.PAY.RECORD' | translate }}</h3>
            <label class="form-label small">{{ 'V2.ADMIN.PAY.METHOD' | translate }}</label>
            <select class="form-select mb-3" name="method" [(ngModel)]="method">
              @for (m of methods; track m) { <option [value]="m">{{ ('V2.ADMIN.METHOD.' + m) | translate }}</option> }
            </select>

            <label class="form-label small">{{ 'V2.ADMIN.PAY.COVERS' | translate }}</label>
            <ul class="list-unstyled mb-3">
              @for (it of unpaidItems(); track it.id) {
                <li>
                  <label class="rpay__check">
                    <input type="checkbox" class="form-check-input" [checked]="selected().has(it.id)" (change)="toggle(it.id)" />
                    <span class="flex-grow-1">{{ it.name | i18n }}@if (it.variant) { · {{ it.variant.label | i18n }} }</span>
                    <strong>{{ money(it.unitPriceCents) }}</strong>
                  </label>
                </li>
              }
            </ul>

            <div class="row g-2 mb-3">
              <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.PAY.REFERENCE' | translate }}</label>
                <input class="form-control" name="reference" maxlength="120" [(ngModel)]="reference" [placeholder]="'V2.ADMIN.PAY.REFERENCE_HINT' | translate" /></div>
              <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.PAY.NOTES' | translate }}</label>
                <input class="form-control" name="notes" maxlength="500" [(ngModel)]="notes" /></div>
            </div>

            <div class="rpay__total mt-0 mb-3"><span>{{ 'V2.ADMIN.PAY.TO_COLLECT' | translate }}</span><strong>{{ money(selectedCents()) }}</strong></div>
            <div class="d-flex gap-2">
              <button type="submit" class="btn btn-brand" [disabled]="busy() || selected().size === 0">{{ 'V2.ADMIN.PAY.CONFIRM' | translate }}</button>
              <button type="button" class="btn btn-light" (click)="recording.set(false)">{{ 'V2.COMMON.CANCEL' | translate }}</button>
            </div>
          </form>
        }
      }
    </ng-container>

    <ul class="list-unstyled mb-0">
      @for (p of detail.payments; track p.id) {
        <li class="rpay__item">
          <div class="d-flex justify-content-between">
            <strong>{{ ('V2.ADMIN.METHOD.' + p.method) | translate }}</strong>
            <strong [class.text-decoration-line-through]="p.status === 'canceled' || p.status === 'refunded'">{{ money(p.amountCents) }}</strong>
          </div>
          <div class="small text-muted">
            {{ ('V2.ADMIN.PAYMENT_ROW.' + p.status) | translate }}@if (p.paidAt) { · {{ when(p.paidAt) }} }@if (p.recordedBy) { · {{ p.recordedBy }} }
            @if (p.refundedCents) { · {{ 'V2.ADMIN.REG.REFUNDED' | translate: { amount: money(p.refundedCents) } }} }
          </div>
          @if (p.reference || p.notes) { <div class="small">{{ p.reference }} {{ p.notes }}</div> }

          <ng-container *appCan="'payments.write'">
            @if (action()?.paymentId === p.id) {
              <div class="rpay__confirm">
                @if (action()!.kind === 'refund') {
                  <label class="form-label small mb-1">{{ 'V2.ADMIN.PAY.REFUND_AMOUNT' | translate }} ({{ 'V2.ADMIN.PAY.UP_TO' | translate: { amount: money(refundable(p)) } }})</label>
                  <input class="form-control form-control-sm mb-2" inputmode="decimal" [(ngModel)]="amountText" [ngModelOptions]="{ standalone: true }" />
                  @if (p.method === 'stripe') { <p class="small text-muted mb-2">{{ 'V2.ADMIN.PAY.STRIPE_NOTE' | translate }}</p> }
                }
                <label class="form-label small mb-1">{{ 'V2.ADMIN.PAY.REASON' | translate }}</label>
                <input class="form-control form-control-sm mb-2" maxlength="255" [(ngModel)]="reason" [ngModelOptions]="{ standalone: true }" />
                @if (formError()) { <div class="small text-danger mb-2">{{ formError() }}</div> }
                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-sm" [class.btn-danger]="action()!.kind === 'void'" [class.btn-warning]="action()!.kind === 'refund'"
                          [disabled]="busy()" (click)="confirmAction(p)">
                    {{ (action()!.kind === 'void' ? 'V2.ADMIN.PAY.VOID' : 'V2.ADMIN.PAY.REFUND') | translate }}</button>
                  <button type="button" class="btn btn-sm btn-light" (click)="action.set(null)">{{ 'V2.COMMON.CANCEL' | translate }}</button>
                </div>
              </div>
            } @else {
              <div class="d-flex gap-2 mt-2">
                @if (canVoid(p)) {
                  <button type="button" class="btn btn-sm btn-outline-danger" [disabled]="busy()" (click)="open('void', p)">{{ 'V2.ADMIN.PAY.VOID' | translate }}</button>
                }
                @if (canRefund(p)) {
                  <button type="button" class="btn btn-sm btn-outline-warning" [disabled]="busy()" (click)="open('refund', p)">{{ 'V2.ADMIN.PAY.REFUND' | translate }}</button>
                }
              </div>
            }
          </ng-container>
        </li>
      } @empty { <p class="text-muted mb-0">{{ 'V2.ADMIN.REG.NO_PAYMENTS' | translate }}</p> }
    </ul>
  `,
    styles: [`
    :host { display: block; }
    .rpay__total { display: flex; justify-content: space-between; margin: 0 0 14px; padding-bottom: 12px; border-bottom: 2px solid var(--border); }
    .rpay__form { border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 16px; background: var(--surface-muted); }
    .rpay__h { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 0 0 10px; }
    .rpay__check { display: flex; gap: 10px; align-items: center; padding: 6px 0; cursor: pointer; margin: 0; }
    .rpay__item { padding: 10px 0; border-bottom: 1px solid var(--border); }
    .rpay__item:last-child { border-bottom: 0; }
    .rpay__confirm { margin-top: 10px; padding: 12px; border-radius: 10px; background: var(--surface-muted); border: 1px solid var(--border); }
  `],
})
export class RegistrationPaymentsComponent {
    @Input({ required: true }) detail!: RegistrationDetail;
    @Input() timezone: string | undefined;
    /** Un pago se registró, anuló o reembolsó: hay que volver a pedir el registro. */
    @Output() changed = new EventEmitter<void>();

    private api = inject(AdminApiService);
    private language = inject(LanguageService);

    readonly methods = METHODS;
    readonly busy = signal(false);
    readonly error = signal<ApiError | null>(null);
    readonly formError = signal<string | null>(null);
    readonly recording = signal(false);
    readonly selected = signal<ReadonlySet<number>>(new Set());
    readonly action = signal<Action>(null);

    method: ManualMethod = 'cash';
    reference = '';
    notes = '';
    reason = '';
    amountText = '';

    /** Productos sin pagar. Son métodos (no computed) porque `detail` es un @Input normal que cambia cuando se refresca el registro. */
    unpaidItems() { return this.detail?.items.filter(i => i.paymentStatus === 'unpaid') ?? []; }
    pendingCents() { return this.unpaidItems().reduce((n, i) => n + i.unitPriceCents, 0); }
    selectedCents() { return this.unpaidItems().filter(i => this.selected().has(i.id)).reduce((n, i) => n + i.unitPriceCents, 0); }

    money(cents: number) { return formatMoney(cents, this.language.currentLang()); }

    when(iso: string) {
        return new Intl.DateTimeFormat(this.language.currentLang() === 'es' ? 'es-MX' : 'en-US', {
            dateStyle: 'medium', timeStyle: 'short', timeZone: this.timezone,
        }).format(new Date(iso));
    }

    // ── Registrar un pago ─────────────────────────────────────────────

    startRecording() {
        this.error.set(null);
        this.method = 'cash';
        this.reference = '';
        this.notes = '';
        this.selected.set(new Set(this.unpaidItems().map(i => i.id)));
        this.recording.set(true);
    }

    toggle(id: number) {
        this.selected.update(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    }

    submitPayment() {
        const ids = [...this.selected()];
        if (!ids.length) return;
        this.run(this.api.recordPayment(this.detail.id, {
            method: this.method,
            // Si se eligieron todos los pendientes, la API cobra "todo lo pendiente"
            itemIds: ids.length === this.unpaidItems().length ? undefined : ids,
            reference: this.reference.trim() || null,
            notes: this.notes.trim() || null,
        }), () => this.recording.set(false));
    }

    // ── Anular y reembolsar ───────────────────────────────────────────

    refundable(p: RegistrationPayment) { return p.amountCents - p.refundedCents; }
    canVoid(p: RegistrationPayment) { return p.method !== 'stripe' && p.status === 'succeeded' && p.refundedCents === 0; }
    canRefund(p: RegistrationPayment) { return ['succeeded', 'partially_refunded'].includes(p.status) && this.refundable(p) > 0; }

    open(kind: 'void' | 'refund', p: RegistrationPayment) {
        this.error.set(null);
        this.formError.set(null);
        this.reason = '';
        this.amountText = (this.refundable(p) / 100).toFixed(2);
        this.action.set({ kind, paymentId: p.id });
    }

    confirmAction(p: RegistrationPayment) {
        const action = this.action();
        if (!action) return;
        const es = this.language.currentLang() === 'es';
        if (this.reason.trim().length < 3) { this.formError.set(es ? 'Escribe el motivo (mínimo 3 letras).' : 'Write the reason (at least 3 letters).'); return; }
        this.formError.set(null);
        if (action.kind === 'void') {
            this.run(this.api.voidPayment(p.id, this.reason.trim()), () => this.action.set(null));
            return;
        }
        const cents = parseDollars(this.amountText);
        if (cents === null || cents <= 0 || cents > this.refundable(p)) {
            this.formError.set(es ? `El monto debe estar entre $0.01 y ${this.money(this.refundable(p))}.` : `The amount must be between $0.01 and ${this.money(this.refundable(p))}.`);
            return;
        }
        // Reembolso total: la API usa lo que queda por devolver
        this.run(this.api.refundPayment(p.id, this.reason.trim(), cents === this.refundable(p) ? undefined : cents), () => this.action.set(null));
    }

    private run(request: Observable<unknown>, done: () => void) {
        this.busy.set(true);
        this.error.set(null);
        request.subscribe({
            next: () => { this.busy.set(false); done(); this.changed.emit(); },
            error: (e: ApiError) => { this.busy.set(false); this.error.set(e); },
        });
    }
}
