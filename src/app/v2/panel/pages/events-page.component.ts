import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { I18nPipe, formatEventDates } from '../../core/i18n';
import { EventSummary } from '../../core/models';
import { EventContextService } from '../event-context.service';

const STATUS_CLASS: Record<EventSummary['status'], string> = {
    draft: 'text-bg-secondary', published: 'text-bg-success', closed: 'text-bg-warning', archived: 'text-bg-light border',
};

@Component({
    selector: 'app-events-page',
    standalone: true,
    imports: [RouterLink, TranslateModule, I18nPipe],
    template: `
    <div class="mb-4">
      <h1 class="page-title">{{ 'V2.PANEL.EVENTS_TITLE' | translate }}</h1>
      <p class="page-subtitle">{{ 'V2.PANEL.EVENTS_SUBTITLE' | translate }}</p>
    </div>

    @if (context.error(); as error) {
      <div class="alert alert-danger d-flex align-items-center justify-content-between">
        <span>{{ error.message }}</span>
        <button class="btn btn-sm btn-outline-danger" (click)="context.load(true)">{{ 'V2.COMMON.RETRY' | translate }}</button>
      </div>
    } @else if (context.events() === null) {
      <p class="text-muted">{{ 'V2.COMMON.LOADING' | translate }}</p>
    } @else if (context.events()!.length === 0) {
      <div class="panel-card text-center text-muted py-5">{{ 'V2.PANEL.NO_EVENTS' | translate }}</div>
    } @else {
      <div class="row g-3">
        @for (event of context.events(); track event.id) {
          <div class="col-12 col-md-6 col-xl-4">
            <a class="panel-card event-card d-block h-100 text-decoration-none" [routerLink]="['/admin/eventos', event.id, 'resumen']">
              <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                <h2 class="event-card__name">{{ event.name | i18n }}</h2>
                <span class="badge {{ statusClass[event.status] }}">{{ ('V2.PANEL.STATUS.' + event.status) | translate }}</span>
              </div>
              <div class="event-card__meta"><i class="bi bi-calendar3"></i>{{ dates(event) }}</div>
              @if (event.venue) { <div class="event-card__meta"><i class="bi bi-geo-alt"></i>{{ event.venue }}</div> }
              <div class="event-card__meta"><i class="bi bi-diagram-3"></i>{{ 'V2.PANEL.ORGANIZER' | translate }}: {{ event.organizer.name }}</div>
            </a>
          </div>
        }
      </div>
    }
  `,
    styles: [`
    .event-card { color: var(--text); transition: border-color .15s, box-shadow .15s; }
    .event-card:hover { border-color: var(--brand-primary); box-shadow: 0 6px 18px -10px rgba(15, 23, 42, .3); }
    .event-card__name { font-size: 16px; font-weight: 700; margin: 0; }
    .event-card__meta { font-size: 13px; color: var(--text-muted); display: flex; gap: 8px; margin-top: 4px; }
  `],
})
export class EventsPageComponent implements OnInit {
    readonly context = inject(EventContextService);
    private language = inject(LanguageService);
    readonly statusClass = STATUS_CLASS;

    ngOnInit() {
        this.context.select(null);
        this.context.load(true);
    }

    dates(event: EventSummary) {
        return formatEventDates(event, this.language.currentLang());
    }
}
