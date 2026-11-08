import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../core/services/language.service';
import { I18nPipe, formatEventDateTime, formatEventDates } from '../core/i18n';
import { ApiError } from '../core/models';
import { PublicApiService } from './public-api.service';
import { AVAILABILITY_BADGE } from './public-home.component';
import { PublicEventPage } from './public.models';

/** Página de un evento: información y sus formularios de registro. */
@Component({
    selector: 'app-event-page',
    standalone: true,
    imports: [RouterLink, TranslateModule, I18nPipe],
    template: `
    <a routerLink="/" class="small text-decoration-none"><i class="bi bi-arrow-left"></i> {{ 'V2.PUBLIC.EVENT.BACK' | translate }}</a>

    @if (page(); as p) {
      <section class="hero mt-3" [style.background-image]="p.event.coverImageUrl ? 'url(' + p.event.coverImageUrl + ')' : null"
               [class.hero--plain]="!p.event.coverImageUrl">
        <div class="hero__overlay">
          <h1 class="hero__title">{{ p.event.name | i18n }}</h1>
        </div>
      </section>

      <div class="row g-4 mt-1">
        <div class="col-12 col-lg-7">
          <div class="panel-card mb-3">
            <div class="info"><i class="bi bi-calendar3"></i><div><div class="info__label">{{ 'V2.PUBLIC.EVENT.WHEN' | translate }}</div>{{ dates() }}</div></div>
            @if (p.event.venue) {
              <div class="info"><i class="bi bi-geo-alt"></i><div><div class="info__label">{{ 'V2.PUBLIC.EVENT.WHERE' | translate }}</div>{{ p.event.venue }}</div></div>
            }
          </div>
          @if (p.event.description) {
            <div class="panel-card description">{{ p.event.description | i18n }}</div>
          }
        </div>

        <div class="col-12 col-lg-5">
          <div class="panel-card">
            <h2 class="h6 fw-bold mb-3">{{ 'V2.PUBLIC.EVENT.REGISTRATION' | translate }}</h2>
            @if (p.forms.length === 0) {
              <p class="text-muted mb-0">{{ 'V2.PUBLIC.EVENT.NO_FORMS' | translate }}</p>
            }
            @for (form of p.forms; track form.id) {
              <div class="form-ref">
                <div class="d-flex justify-content-between align-items-start gap-2">
                  <strong>{{ form.title | i18n }}</strong>
                  <span class="badge {{ badge[form.availability] }}">{{ ('V2.PUBLIC.AVAILABILITY.' + form.availability) | translate }}</span>
                </div>
                @if (form.availability === 'not_open_yet' && form.opensAt) {
                  <div class="small text-muted mt-1">{{ 'V2.PUBLIC.EVENT.OPENS_ON' | translate: { date: dateTime(form.opensAt) } }}</div>
                }
                @if (form.availability === 'open' && form.closesAt) {
                  <div class="small text-muted mt-1">{{ 'V2.PUBLIC.EVENT.CLOSES_ON' | translate: { date: dateTime(form.closesAt) } }}</div>
                }
                @if (form.availability === 'open') {
                  <a class="btn btn-brand w-100 mt-3" [routerLink]="['/evento', p.event.slug, 'registro', form.id]">{{ 'V2.PUBLIC.EVENT.REGISTER_NOW' | translate }}</a>
                }
              </div>
            }
          </div>
        </div>
      </div>
    } @else if (notFound()) {
      <div class="panel-card text-center py-5 mt-3">{{ 'V2.PUBLIC.EVENT.NOT_FOUND' | translate }}</div>
    } @else if (error()) {
      <div class="alert alert-danger mt-3">{{ error()!.message }}</div>
    } @else if (!page()) {
      <p class="text-muted mt-3">{{ 'V2.COMMON.LOADING' | translate }}</p>
    }
  `,
    styles: [`
    .hero { border-radius: 14px; overflow: hidden; background-size: cover; background-position: center; min-height: 190px; display: flex; align-items: flex-end; }
    .hero--plain { background: linear-gradient(135deg, var(--brand-primary), color-mix(in srgb, var(--brand-primary) 55%, #000)); min-height: 130px; }
    .hero__overlay { width: 100%; padding: 22px 24px; background: linear-gradient(to top, rgba(0,0,0,.65), transparent); }
    .hero__title { color: #fff; font-size: 28px; font-weight: 800; margin: 0; }
    .info { display: flex; gap: 12px; align-items: flex-start; padding: 6px 0; }
    .info i { color: var(--brand-primary); font-size: 18px; margin-top: 2px; }
    .info__label { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); }
    .description { white-space: pre-line; line-height: 1.6; }
    .form-ref { padding: 12px 0; border-top: 1px solid var(--border); }
    .form-ref:first-of-type { border-top: 0; padding-top: 0; }
    @media (max-width: 575.98px) { .hero__title { font-size: 22px; } }
  `],
})
export class EventPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private api = inject(PublicApiService);
    private language = inject(LanguageService);
    readonly badge = AVAILABILITY_BADGE;

    readonly page = signal<PublicEventPage | null>(null);
    readonly notFound = signal(false);
    readonly error = signal<ApiError | null>(null);

    ngOnInit() {
        this.api.eventPage(this.route.snapshot.paramMap.get('slug') ?? '').subscribe({
            next: page => this.page.set(page),
            error: (e: ApiError) => e.status === 404 ? this.notFound.set(true) : this.error.set(e),
        });
    }

    dates() {
        const p = this.page();
        return p ? formatEventDates(p.event, this.language.currentLang()) : '';
    }

    dateTime(iso: string) {
        return formatEventDateTime(iso, this.page()!.event.timezone, this.language.currentLang());
    }
}
