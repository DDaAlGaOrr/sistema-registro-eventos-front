import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { I18nPipe } from '../../core/i18n';
import { ApiError } from '../../core/models';
import { AdminApiService } from '../admin-api.service';
import { EventContextService } from '../event-context.service';
import { FormListItem, FormStatus } from './builder.models';

const STATUS_BADGE: Record<FormStatus, string> = { draft: 'text-bg-secondary', open: 'text-bg-success', closed: 'text-bg-dark' };

/** Formularios del evento: lista y creación de uno nuevo. */
@Component({
    selector: 'app-forms-list-page',
    standalone: true,
    imports: [RouterLink, TranslateModule, I18nPipe],
    template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <h1 class="page-title">{{ 'V2.PANEL.MENU.FORMS' | translate }}</h1>
        <p class="page-subtitle">{{ 'V2.ADMIN.BUILDER.LIST_SUBTITLE' | translate }}</p>
      </div>
      <button type="button" class="btn btn-brand" (click)="creating.set(true)"><i class="bi bi-plus-lg"></i> {{ 'V2.ADMIN.BUILDER.NEW_FORM' | translate }}</button>
    </div>

    @if (error()) { <div class="alert alert-danger">{{ error()!.message }}</div> }

    @if (creating()) {
      <form class="panel-card mb-3" (submit)="$event.preventDefault(); create()">
        <h2 class="fs-6 fw-bold mb-3">{{ 'V2.ADMIN.BUILDER.NEW_FORM' | translate }}</h2>
        <div class="row g-2 mb-3">
          <div class="col-12 col-md-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.TITLE' | translate }} (ES)</label>
            <input class="form-control" maxlength="150" [value]="titleEs()" (input)="titleEs.set($any($event.target).value)" /></div>
          <div class="col-12 col-md-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.TITLE' | translate }} (EN)</label>
            <input class="form-control" maxlength="150" [value]="titleEn()" (input)="titleEn.set($any($event.target).value)" /></div>
        </div>
        <div class="d-flex gap-2">
          <button type="submit" class="btn btn-brand" [disabled]="busy() || !titleEs().trim() || !titleEn().trim()">{{ 'V2.ADMIN.BUILDER.CREATE' | translate }}</button>
          <button type="button" class="btn btn-light" (click)="creating.set(false)">{{ 'V2.COMMON.CANCEL' | translate }}</button>
        </div>
      </form>
    }

    @if (forms(); as list) {
      <div class="row g-3">
        @for (f of list; track f.id) {
          <div class="col-12 col-md-6 col-xl-4">
            <div class="panel-card h-100 d-flex flex-column">
              <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                <h2 class="fs-6 fw-bold mb-0">{{ f.title | i18n }}</h2>
                <span class="badge {{ badge[f.status] }}">{{ ('V2.ADMIN.BUILDER.STATUS.' + f.status) | translate }}</span>
              </div>
              <p class="text-muted small mb-3">
                {{ f.publishedVersion ? ('V2.ADMIN.BUILDER.PUBLISHED_VERSION' | translate: { version: f.publishedVersion }) : ('V2.ADMIN.BUILDER.NOT_PUBLISHED' | translate) }}
                · {{ 'V2.ADMIN.BUILDER.REGISTRATIONS' | translate: { count: f.registrations } }}
              </p>
              <a class="btn btn-outline-primary mt-auto" [routerLink]="[f.id]"><i class="bi bi-pencil-square"></i> {{ 'V2.ADMIN.BUILDER.EDIT' | translate }}</a>
            </div>
          </div>
        } @empty {
          <div class="col-12"><div class="panel-card text-center text-muted py-5">{{ 'V2.ADMIN.BUILDER.NO_FORMS' | translate }}</div></div>
        }
      </div>
    } @else if (!error()) {
      <p class="text-muted">{{ 'V2.COMMON.LOADING' | translate }}</p>
    }
  `,
})
export class FormsListPageComponent {
    readonly context = inject(EventContextService);
    private api = inject(AdminApiService);
    private router = inject(Router);

    readonly badge = STATUS_BADGE;
    readonly forms = signal<FormListItem[] | null>(null);
    readonly error = signal<ApiError | null>(null);
    readonly creating = signal(false);
    readonly busy = signal(false);
    readonly titleEs = signal('');
    readonly titleEn = signal('');

    constructor() {
        effect(() => {
            const id = this.context.currentEventId();
            if (!id) return;
            this.forms.set(null);
            this.error.set(null);
            this.api.forms(id).subscribe({ next: l => this.forms.set(l), error: (e: ApiError) => this.error.set(e) });
        }, { allowSignalWrites: true });
    }

    create() {
        const eventId = this.context.currentEventId();
        if (!eventId) return;
        this.busy.set(true);
        this.error.set(null);
        this.api.createForm(eventId, { es: this.titleEs().trim(), en: this.titleEn().trim() }).subscribe({
            next: f => { this.busy.set(false); void this.router.navigate(['/admin/eventos', eventId, 'formularios', f.id]); },
            error: (e: ApiError) => { this.busy.set(false); this.error.set(e); },
        });
    }
}
