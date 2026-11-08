import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { I18nPipe, formatMoney } from '../../core/i18n';
import { FormFieldComponent } from '../../public/form-field.component';
import { FormState } from '../../public/form-state';
import { PublicApiService } from '../../public/public-api.service';
import { HALF_WIDTH } from '../../public/registration-page.component';
import { FormField, FormSchema, FormStep, PublicForm, PublicItem } from '../../public/public.models';
import { AdminForm, AdminItem } from './builder.models';
import { sanitizeSchema } from './schema-utils';

/** Convierte los productos del administrador en los que ve el público (solo activos, con su precio final). */
export function toPublicItems(items: AdminItem[]): PublicItem[] {
    return items.filter(i => i.isActive).map(i => ({
        code: i.code, kind: i.kind, name: i.name, description: i.description, priceCents: i.priceCents, isRequired: i.isRequired,
        variants: i.variants.filter(v => v.isActive).map(v => ({
            code: v.code, label: v.label, priceCents: v.priceCentsOverride ?? i.priceCents, soldOut: v.stock !== null && v.stock <= 0,
        })),
    }));
}

/**
 * Vista previa del formulario tal como lo verá el público, con el mismo motor
 * que el formulario de registro (condiciones, validación y total). No envía nada.
 */
@Component({
    selector: 'app-form-preview',
    standalone: true,
    imports: [TranslateModule, I18nPipe, FormFieldComponent],
    template: `
    <div class="fp__backdrop" (click)="closed.emit()"></div>
    <section class="fp" role="dialog" aria-modal="true">
      <header class="fp__head">
        <div>
          <strong>{{ 'V2.ADMIN.BUILDER.PREVIEW_TITLE' | translate }}</strong>
          <span class="text-muted small ms-2">{{ 'V2.ADMIN.BUILDER.PREVIEW_NOTE' | translate }}</span>
        </div>
        <div class="d-flex gap-2 align-items-center">
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="language.toggleLanguage()"><i class="bi bi-translate"></i> {{ 'V2.COMMON.LANGUAGE' | translate }}</button>
          <button type="button" class="btn-close" [attr.aria-label]="'V2.COMMON.CLOSE' | translate" (click)="closed.emit()"></button>
        </div>
      </header>

      <div class="fp__body">
        @if (state(); as s) {
         @if (!s.steps().length) {
          <p class="text-muted text-center py-5 mb-0">{{ 'V2.ADMIN.BUILDER.PREVIEW_EMPTY' | translate }}</p>
         } @else {
          <div class="mb-3">
            <div class="small text-muted mb-1">
              {{ 'V2.PUBLIC.FORM.STEP_OF' | translate: { current: s.stepIndex() + 1, total: s.steps().length } }}
              · <strong>{{ s.currentStep()?.title | i18n }}</strong>
            </div>
            <div class="progress" style="height: 6px"><div class="progress-bar" [style.width.%]="progress()"></div></div>
          </div>

          @if (s.currentStep(); as step) {
            <div class="row g-3">
              @for (field of visibleFields(step); track field.key) {
                <div [class]="colClass(field)"><app-form-field [field]="field" [state]="s" /></div>
              }
            </div>
          } @else {
            <p class="text-muted text-center py-4 mb-0">{{ 'V2.ADMIN.BUILDER.PREVIEW_END' | translate }}</p>
          }

          @if (s.lines().length) {
            <div class="fp__total"><span>{{ 'V2.PUBLIC.FORM.TOTAL' | translate }}</span><strong>{{ money(s.totalCents()) }}</strong></div>
          }
         }
        }
      </div>

      <footer class="fp__foot">
        <button type="button" class="btn btn-light" [disabled]="state().stepIndex() === 0" (click)="state().back()">{{ 'V2.PUBLIC.FORM.BACK' | translate }}</button>
        <button type="button" class="btn btn-brand" [disabled]="state().onReview()" (click)="state().next()">{{ 'V2.PUBLIC.FORM.NEXT' | translate }}</button>
      </footer>
    </section>
  `,
    styles: [`
    :host { display: contents; }
    .fp__backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .5); z-index: 1060; }
    .fp { position: fixed; z-index: 1061; top: 4vh; left: 50%; transform: translateX(-50%); width: min(720px, 96vw); max-height: 92vh;
      display: flex; flex-direction: column; background: var(--surface); border-radius: 16px; box-shadow: 0 20px 60px rgba(15, 23, 42, .3); overflow: hidden; }
    .fp__head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--border); }
    .fp__body { padding: 20px; overflow-y: auto; flex: 1; }
    .fp__foot { display: flex; justify-content: space-between; padding: 12px 20px; border-top: 1px solid var(--border); }
    .fp__total { display: flex; justify-content: space-between; margin-top: 18px; padding-top: 12px; border-top: 2px solid var(--border); }
    .progress-bar { background: var(--brand-primary); }
  `],
})
export class FormPreviewComponent implements OnInit {
    @Input({ required: true }) schema!: FormSchema;
    @Input({ required: true }) form!: AdminForm;
    @Output() closed = new EventEmitter<void>();

    readonly language = inject(LanguageService);
    private publicApi = inject(PublicApiService);

    readonly state = signal<FormState>(null as unknown as FormState);
    readonly progress = computed(() => {
        const s = this.state();
        const total = s.steps().length;
        return total ? Math.round(((s.stepIndex() + 1) / total) * 100) : 0;
    });

    ngOnInit() {
        // Con lo que hay en pantalla, aunque no esté guardado
        const publicForm = {
            id: this.form.id, title: this.form.title, version: 0, schema: sanitizeSchema(this.schema),
            items: toPublicItems(this.form.items),
            payments: { enabled: this.form.payments.enabled, online: this.form.payments.online, offline: this.form.payments.offline, currency: this.form.payments.currency },
            opensAt: null, closesAt: null, availability: 'open',
        } as unknown as PublicForm;
        const state = new FormState(publicForm, this.publicApi);
        this.publicApi.locations().subscribe({ next: l => state.locations.set(l), error: () => undefined });
        this.state.set(state);
    }

    visibleFields(step: FormStep): FormField[] {
        const visible = this.state().visible();
        return step.fields.filter(f => visible.has(f.key));
    }

    colClass(field: FormField) { return HALF_WIDTH.has(field.type) ? 'col-12 col-md-6' : 'col-12'; }

    money(cents: number) { return formatMoney(cents, this.language.currentLang(), this.form.payments.currency.toUpperCase()); }
}
