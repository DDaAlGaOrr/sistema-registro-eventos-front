import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../core/services/language.service';
import { I18nPipe, formatEventDates } from '../core/i18n';
import { ApiError } from '../core/models';
import { PublicApiService } from './public-api.service';
import { Availability, PublicEventListItem } from './public.models';

export const AVAILABILITY_BADGE: Record<Availability, string> = {
    open: 'text-bg-success', not_open_yet: 'text-bg-info', closed: 'text-bg-secondary', full: 'text-bg-warning',
};

/** Inicio del cliente: sus eventos publicados. */
@Component({
    selector: 'app-public-home',
    standalone: true,
    imports: [RouterLink, TranslateModule, I18nPipe],
    template: `
    <div class="mb-4">
      <h1 class="page-title">{{ 'V2.PUBLIC.HOME.TITLE' | translate }}</h1>
      <p class="page-subtitle">{{ 'V2.PUBLIC.HOME.SUBTITLE' | translate }}</p>
    </div>

    @if (error()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center">
        <span>{{ error()!.message }}</span>
        <button class="btn btn-sm btn-outline-danger" (click)="load()">{{ 'V2.COMMON.RETRY' | translate }}</button>
      </div>
    } @else if (events() === null) {
      <p class="text-muted">{{ 'V2.COMMON.LOADING' | translate }}</p>
    } @else if (events()!.length === 0) {
      <div class="panel-card text-center text-muted py-5">{{ 'V2.PUBLIC.HOME.NO_EVENTS' | translate }}</div>
    } @else {
      <div class="row g-3">
        @for (event of events(); track event.id) {
          <div class="col-12 col-md-6">
            <article class="panel-card h-100 d-flex flex-column event">
              @if (event.coverImageUrl) { <img [src]="event.coverImageUrl" alt="" class="event__cover" /> }
              <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                <h2 class="event__name">{{ event.name | i18n }}</h2>
                <span class="badge {{ badge[event.availability] }} flex-shrink-0">{{ ('V2.PUBLIC.AVAILABILITY.' + event.availability) | translate }}</span>
              </div>
              <div class="event__meta"><i class="bi bi-calendar3"></i>{{ dates(event) }}</div>
              @if (event.venue) { <div class="event__meta"><i class="bi bi-geo-alt"></i>{{ event.venue }}</div> }
              <div class="mt-auto pt-3 d-flex gap-2 flex-wrap">
                @if (event.availability === 'open' && event.openFormId) {
                  <a class="btn btn-brand btn-sm" [routerLink]="['/evento', event.slug, 'registro', event.openFormId]">{{ 'V2.PUBLIC.HOME.REGISTER' | translate }}</a>
                }
                <a class="btn btn-outline-secondary btn-sm" [routerLink]="['/evento', event.slug]">{{ 'V2.PUBLIC.HOME.VIEW' | translate }}</a>
              </div>
            </article>
          </div>
        }
      </div>
    }
  `,
    styles: [`
    .event__cover { width: calc(100% + 40px); margin: -20px -20px 14px; max-height: 160px; object-fit: cover; border-radius: 12px 12px 0 0; }
    .event__name { font-size: 17px; font-weight: 700; margin: 0; }
    .event__meta { font-size: 13px; color: var(--text-muted); display: flex; gap: 8px; margin-top: 4px; }
  `],
})
export class PublicHomeComponent implements OnInit {
    private api = inject(PublicApiService);
    private language = inject(LanguageService);
    readonly badge = AVAILABILITY_BADGE;
    readonly events = signal<PublicEventListItem[] | null>(null);
    readonly error = signal<ApiError | null>(null);

    ngOnInit() { this.load(); }

    load() {
        this.error.set(null);
        this.api.events().subscribe({
            next: list => {
                // Los que se pueden registrar primero; luego por fecha (próximos antes)
                const rank = (e: PublicEventListItem) => e.availability === 'open' ? 0 : e.availability === 'not_open_yet' ? 1 : 2;
                this.events.set([...list].sort((a, b) => rank(a) - rank(b) || a.startsAt.localeCompare(b.startsAt)));
            },
            error: (e: ApiError) => this.error.set(e),
        });
    }

    dates(event: PublicEventListItem) { return formatEventDates(event, this.language.currentLang()); }
}
