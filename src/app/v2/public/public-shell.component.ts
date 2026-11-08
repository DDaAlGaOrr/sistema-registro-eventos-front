import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../core/services/language.service';
import { TenantService } from '../core/tenant.service';

/** Marco de las páginas públicas: marca del cliente, idioma y contenido. */
@Component({
    selector: 'app-public-shell',
    standalone: true,
    imports: [RouterOutlet, RouterLink, TranslateModule],
    template: `
    <div class="pub">
      <header class="pub__header">
        <a routerLink="/" class="pub__brand">
          @if (tenant.branding?.logoUrl) {
            <img [src]="tenant.branding!.logoUrl" [alt]="tenant.branding!.name" class="pub__logo" />
          } @else {
            <span class="pub__monogram"><i class="bi bi-calendar2-check"></i></span>
          }
          <span class="pub__name">{{ tenant.branding?.name }}</span>
        </a>
        <button type="button" class="btn btn-light btn-sm" (click)="language.toggleLanguage()">
          <i class="bi bi-translate me-1"></i>{{ 'V2.COMMON.LANGUAGE' | translate }}
        </button>
      </header>

      <main class="pub__main">
        @switch (tenant.state().kind) {
          @case ('not_found') { <div class="alert alert-warning">{{ 'V2.AUTH.TENANT_NOT_FOUND' | translate }}</div> }
          @case ('error') { <div class="alert alert-danger">{{ 'V2.AUTH.TENANT_ERROR' | translate }}</div> }
          @case ('platform') {
            <div class="panel-card text-center py-5">
              <p class="mb-3">{{ 'V2.AUTH.PLATFORM' | translate }}</p>
              <a routerLink="/login" class="btn btn-brand">{{ 'V2.AUTH.SIGN_IN' | translate }}</a>
            </div>
          }
          @default { <router-outlet /> }
        }
      </main>
    </div>
  `,
    styles: [`
    .pub { min-height: 100vh; display: flex; flex-direction: column; }
    .pub__header {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 12px 20px; background: #fff; border-bottom: 1px solid var(--border);
    }
    .pub__brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text); min-width: 0; }
    .pub__logo { max-height: 36px; max-width: 140px; object-fit: contain; }
    .pub__monogram {
      width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0; background: var(--brand-primary); color: #fff;
      display: flex; align-items: center; justify-content: center;
    }
    .pub__name { font-weight: 700; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pub__main { flex: 1; padding: 28px 16px 48px; width: 100%; max-width: 980px; margin: 0 auto; }
    @media (max-width: 575.98px) { .pub__header { padding: 10px 14px; } .pub__main { padding: 20px 14px 40px; } }
  `],
})
export class PublicShellComponent {
    readonly tenant = inject(TenantService);
    readonly language = inject(LanguageService);
}
