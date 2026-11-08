import { Component, Input, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../core/services/language.service';
import { TenantService } from '../core/tenant.service';

/** Tarjeta centrada con la marca del cliente, compartida por las pantallas de acceso. */
@Component({
    selector: 'app-auth-card',
    standalone: true,
    imports: [TranslateModule],
    template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-card__brand">
          @if (tenant.branding?.logoUrl) {
            <img [src]="tenant.branding!.logoUrl" [alt]="tenant.branding!.name" class="auth-card__logo" />
          } @else {
            <div class="auth-card__monogram"><i class="bi bi-calendar2-check"></i></div>
          }
          <div class="auth-card__tenant">
            @switch (tenant.state().kind) {
              @case ('tenant') { {{ tenant.branding!.name }} }
              @case ('platform') { {{ 'V2.AUTH.PLATFORM' | translate }} }
            }
          </div>
        </div>

        @switch (tenant.state().kind) {
          @case ('not_found') {
            <div class="alert alert-warning mb-0">{{ 'V2.AUTH.TENANT_NOT_FOUND' | translate }}</div>
          }
          @case ('error') {
            <div class="alert alert-danger mb-0">{{ 'V2.AUTH.TENANT_ERROR' | translate }}</div>
          }
          @default {
            <h1 class="auth-card__title">{{ title }}</h1>
            @if (subtitle) { <p class="auth-card__subtitle">{{ subtitle }}</p> }
            <ng-content />
          }
        }
      </div>
      <button type="button" class="btn btn-link btn-sm text-muted mt-3" (click)="language.toggleLanguage()">
        <i class="bi bi-translate me-1"></i>{{ 'V2.COMMON.LANGUAGE' | translate }}
      </button>
    </div>
  `,
    styles: [`
    .auth-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 24px 16px; background: var(--surface-muted); }
    .auth-card { width: 100%; max-width: 420px; background: #fff; border: 1px solid var(--border); border-radius: 16px;
      padding: 32px 28px; box-shadow: 0 10px 30px -12px rgba(15, 23, 42, .15); }
    .auth-card__brand { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 24px; }
    .auth-card__logo { max-height: 56px; max-width: 200px; object-fit: contain; }
    .auth-card__monogram { width: 48px; height: 48px; border-radius: 12px; background: var(--brand-primary); color: #fff;
      display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .auth-card__tenant { font-size: 14px; color: var(--text-muted); text-align: center; }
    .auth-card__title { font-size: 22px; font-weight: 700; color: var(--text); margin: 0 0 4px; text-align: center; }
    .auth-card__subtitle { color: var(--text-muted); text-align: center; margin-bottom: 20px; font-size: 14px; }
  `],
})
export class AuthCardComponent {
    @Input({ required: true }) title = '';
    @Input() subtitle = '';
    readonly tenant = inject(TenantService);
    readonly language = inject(LanguageService);
}
