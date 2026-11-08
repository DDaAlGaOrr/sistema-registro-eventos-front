import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import QRCode from 'qrcode';
import { LanguageService } from '../../core/services/language.service';
import { I18nPipe, formatEventDates, formatMoney } from '../core/i18n';
import { ApiError } from '../core/models';
import { PublicApiService } from './public-api.service';
import { PublicRegistration } from './public.models';

const POLL_MS = 3000;
const POLL_MAX = 10;

/**
 * /registro/confirmacion/:code — a donde lleva el correo y el regreso de
 * Stripe (?pago=exito | cancelado | error). Muestra el QR de entrada.
 */
@Component({
    selector: 'app-confirmation-page',
    standalone: true,
    imports: [RouterLink, TranslateModule, I18nPipe],
    template: `
    @if (reg(); as r) {
      <div class="confirm">

        <!-- Mensajes según el regreso del pago -->
        @if (payResult() === 'exito' && r.paymentStatus !== 'paid') {
          <div class="alert alert-info"><span class="spinner-border spinner-border-sm me-2"></span>{{ 'V2.PUBLIC.CONFIRM.PAY_CHECKING' | translate }}</div>
        }
        @if (payResult() === 'exito' && r.paymentStatus === 'paid') {
          <div class="alert alert-success">{{ 'V2.PUBLIC.CONFIRM.PAY_OK' | translate }}</div>
        }
        @if (payResult() === 'cancelado') {
          <div class="alert alert-warning">{{ 'V2.PUBLIC.CONFIRM.PAY_CANCELED' | translate }}</div>
        }
        @if (payResult() === 'error' || checkoutError()) {
          <div class="alert alert-danger">{{ 'V2.PUBLIC.CONFIRM.CHECKOUT_ERROR' | translate }}</div>
        }

        @if (r.status === 'cancelled') {
          <div class="panel-card text-center py-5">
            <i class="bi bi-x-circle fs-1 text-muted"></i>
            <p class="mt-2 mb-0">{{ 'V2.PUBLIC.CONFIRM.CANCELLED' | translate }}</p>
          </div>
        } @else {
          <section class="panel-card text-center">
            <div class="confirm__icon" [class.confirm__icon--pending]="r.status === 'pending_payment'">
              <i class="bi" [class.bi-check-lg]="r.status === 'confirmed'" [class.bi-hourglass-split]="r.status === 'pending_payment'"></i>
            </div>
            <h1 class="confirm__title">{{ (r.status === 'confirmed' ? 'V2.PUBLIC.CONFIRM.TITLE' : 'V2.PUBLIC.CONFIRM.TITLE_PENDING') | translate }}</h1>
            <p class="text-muted mb-1">{{ 'V2.PUBLIC.CONFIRM.HELLO' | translate: { name: r.firstName } }}</p>
            <p class="fw-semibold mb-0">{{ r.event.name | i18n }}</p>
            <p class="text-muted small mb-0">{{ dates() }}@if (r.event.venue) { · {{ r.event.venue }} }</p>
          </section>

          <!-- Código de entrada -->
          @if (qr()) {
            <section class="panel-card text-center mt-3">
              <h2 class="confirm__h2">{{ 'V2.PUBLIC.CONFIRM.QR_TITLE' | translate }}</h2>
              <p class="text-muted small">{{ 'V2.PUBLIC.CONFIRM.QR_TEXT' | translate }}</p>
              <img [src]="qr()" alt="QR" class="confirm__qr" width="220" height="220" />
              <div class="small text-muted mt-2">{{ 'V2.PUBLIC.CONFIRM.CODE' | translate }}: <code>{{ r.publicCode }}</code></div>
              <a class="btn btn-outline-secondary btn-sm mt-3" [href]="qr()" [download]="'registro-' + r.publicCode + '.png'">
                <i class="bi bi-download me-1"></i>{{ 'V2.PUBLIC.CONFIRM.DOWNLOAD_QR' | translate }}
              </a>
              @if (r.checkedIn) { <div class="badge text-bg-success mt-3 d-block">{{ 'V2.PUBLIC.CONFIRM.CHECKED_IN' | translate }}</div> }
            </section>
          }

          <!-- Lo que eligió y el pago -->
          @if (r.items.length || r.totalCents > 0) {
            <section class="panel-card mt-3">
              <h2 class="confirm__h2">{{ 'V2.PUBLIC.CONFIRM.YOUR_SELECTIONS' | translate }}</h2>
              <ul class="confirm__lines">
                @for (item of r.items; track $index) {
                  <li>
                    <span>{{ item.name | i18n }}@if (item.variant) { <span class="text-muted"> · {{ item.variant.label | i18n }}</span> }</span>
                    @if (r.totalCents > 0) { <span>{{ money(item.unitPriceCents) }}</span> }
                  </li>
                }
              </ul>
              @if (r.totalCents > 0) {
                <div class="confirm__total"><span>{{ 'V2.PUBLIC.CONFIRM.TOTAL' | translate }}</span><strong>{{ money(r.totalCents) }}</strong></div>
                <div class="mt-2">
                  <span class="badge" [class.text-bg-success]="r.paymentStatus === 'paid'" [class.text-bg-warning]="r.paymentStatus !== 'paid'">
                    {{ (r.paymentStatus === 'paid' ? 'V2.PUBLIC.CONFIRM.PAID' : 'V2.PUBLIC.CONFIRM.PENDING') | translate }}
                  </span>
                </div>
                @if (r.paymentStatus !== 'paid') {
                  @if (r.canPayOnline) {
                    <button type="button" class="btn btn-brand w-100 mt-3" [disabled]="paying()" (click)="pay()">
                      <i class="bi bi-credit-card me-1"></i>{{ 'V2.PUBLIC.CONFIRM.PAY_NOW' | translate }}
                    </button>
                  }
                  <p class="small text-muted mt-3 mb-0">{{ 'V2.PUBLIC.CONFIRM.PAY_OFFLINE_NOTE' | translate }}</p>
                }
              }
            </section>
          }

          @if (r.confirmationMessage) {
            <section class="panel-card mt-3" style="white-space: pre-line">{{ r.confirmationMessage | i18n }}</section>
          }
          <p class="text-center text-muted small mt-3">{{ 'V2.PUBLIC.CONFIRM.EMAIL_NOTE' | translate }}</p>
        }
      </div>
    } @else if (notFound()) {
      <div class="panel-card text-center py-5">
        <p class="mb-3">{{ 'V2.PUBLIC.CONFIRM.NOT_FOUND' | translate }}</p>
        <a routerLink="/" class="btn btn-brand">{{ 'V2.PUBLIC.EVENT.BACK' | translate }}</a>
      </div>
    } @else if (error()) {
      <div class="alert alert-danger">{{ error()!.message }}</div>
    } @else if (!reg()) {
      <p class="text-muted text-center py-5">{{ 'V2.COMMON.LOADING' | translate }}</p>
    }
  `,
    styles: [`
    .confirm { max-width: 560px; margin: 0 auto; }
    .confirm__icon { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 12px; background: #d1e7dd; color: #0f5132;
      display: flex; align-items: center; justify-content: center; font-size: 32px; }
    .confirm__icon--pending { background: #fff3cd; color: #664d03; }
    .confirm__title { font-size: 24px; font-weight: 800; margin: 0 0 6px; }
    .confirm__h2 { font-size: 16px; font-weight: 700; margin: 0 0 8px; }
    .confirm__qr { border: 1px solid var(--border); border-radius: 12px; padding: 8px; background: #fff; }
    .confirm__lines { list-style: none; padding: 0; margin: 0; }
    .confirm__lines li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px dashed var(--border); font-size: 14px; }
    .confirm__total { display: flex; justify-content: space-between; padding-top: 10px; font-size: 16px; }
  `],
})
export class ConfirmationPageComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private api = inject(PublicApiService);
    private language = inject(LanguageService);

    readonly code = (this.route.snapshot.paramMap.get('code') ?? '').toUpperCase();
    readonly payResult = signal<string | null>(this.route.snapshot.queryParamMap.get('pago'));

    readonly reg = signal<PublicRegistration | null>(null);
    readonly qr = signal<string | null>(null);
    readonly notFound = signal(false);
    readonly error = signal<ApiError | null>(null);
    readonly paying = signal(false);
    readonly checkoutError = signal(false);

    private timer: ReturnType<typeof setTimeout> | null = null;
    private polls = 0;

    ngOnInit() {
        this.load();
    }

    ngOnDestroy() {
        if (this.timer) clearTimeout(this.timer);
    }

    private load() {
        this.api.registration(this.code).subscribe({
            next: async r => {
                this.reg.set(r);
                if (!this.qr() && r.status !== 'cancelled') {
                    this.qr.set(await QRCode.toDataURL(r.publicCode, { width: 440, margin: 1, errorCorrectionLevel: 'M' }));
                }
                // Stripe avisa por webhook; si volvió del pago, espera unos segundos a que llegue
                if (this.payResult() === 'exito' && r.paymentStatus !== 'paid' && this.polls < POLL_MAX) {
                    this.polls++;
                    this.timer = setTimeout(() => this.load(), POLL_MS);
                }
            },
            error: (e: ApiError) => e.status === 404 ? this.notFound.set(true) : this.error.set(e),
        });
    }

    dates() {
        const r = this.reg();
        return r ? formatEventDates(r.event, this.language.currentLang()) : '';
    }

    money(cents: number) {
        return formatMoney(cents, this.language.currentLang(), (this.reg()?.currency ?? 'usd').toUpperCase());
    }

    pay() {
        this.paying.set(true);
        this.checkoutError.set(false);
        this.api.checkout(this.code).subscribe({
            next: r => { window.location.href = r.checkoutUrl; },
            error: () => { this.paying.set(false); this.checkoutError.set(true); },
        });
    }
}
