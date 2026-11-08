import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CanDeactivateFn, ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { I18nPipe } from '../../core/i18n';
import { ApiError } from '../../core/models';
import { FieldType, FormSchema } from '../../public/public.models';
import { AdminApiService } from '../admin-api.service';
import { EventContextService } from '../event-context.service';
import { AdminForm, FormVersionInfo, SchemaIssue } from './builder.models';
import { BuilderState } from './builder-state';
import { FieldPropertiesComponent } from './field-properties.component';
import { FormPreviewComponent } from './form-preview.component';
import { FIELD_TYPES, FieldTypeInfo, locatePath, sanitizeSchema, starterSchema } from './schema-utils';

type Group = FieldTypeInfo['group'];
const GROUPS: Group[] = ['basic', 'choice', 'system'];

/** Pide confirmación al salir con cambios sin guardar. */
export const leaveEditorGuard: CanDeactivateFn<FormEditorPageComponent> = (component) => component.confirmLeave();

/**
 * Editor de un formulario: pasos y campos (con arrastrar y soltar), propiedades en
 * español e inglés, condiciones, vista previa, guardar borrador y publicar.
 */
@Component({
    selector: 'app-form-editor-page',
    standalone: true,
    imports: [
        RouterLink, TranslateModule, I18nPipe, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle,
        FieldPropertiesComponent, FormPreviewComponent,
    ],
    template: `
    @if (form(); as f) {
      @if (state(); as s) {
        <div class="fe">
          <header class="fe__head">
            <div class="min-w-0">
              <a [routerLink]="['/admin/eventos', eventId, 'formularios']" class="small text-muted"><i class="bi bi-arrow-left"></i> {{ 'V2.ADMIN.BUILDER.BACK' | translate }}</a>
              <h1 class="page-title text-truncate">{{ f.title | i18n }}</h1>
              <div class="small text-muted">
                @if (f.draftVersion; as d) { {{ 'V2.ADMIN.BUILDER.DRAFT_VERSION' | translate: { version: d.version } }} }
                @else { {{ 'V2.ADMIN.BUILDER.NO_DRAFT' | translate }} }
                @if (f.publishedVersion; as p) { · {{ 'V2.ADMIN.BUILDER.PUBLISHED_VERSION' | translate: { version: p.version } }} }
                @if (s.dirty()) { · <span class="text-warning fw-semibold">{{ 'V2.ADMIN.BUILDER.UNSAVED' | translate }}</span> }
              </div>
            </div>
            <div class="fe__actions">
              <button type="button" class="btn btn-outline-secondary" (click)="showPreview.set(true)"><i class="bi bi-eye"></i> {{ 'V2.ADMIN.BUILDER.PREVIEW' | translate }}</button>
              <button type="button" class="btn btn-outline-secondary" [disabled]="!s.dirty() || busy()" (click)="discard()">{{ 'V2.ADMIN.BUILDER.DISCARD' | translate }}</button>
              <button type="button" class="btn btn-outline-primary" [disabled]="!s.dirty() || busy()" (click)="save()"><i class="bi bi-save"></i> {{ 'V2.ADMIN.BUILDER.SAVE' | translate }}</button>
              <button type="button" class="btn btn-brand" [disabled]="busy() || (!s.dirty() && !f.draftVersion)" (click)="startPublish()"><i class="bi bi-cloud-upload"></i> {{ 'V2.ADMIN.BUILDER.PUBLISH' | translate }}</button>
            </div>
          </header>

          @if (message(); as m) { <div class="alert alert-success py-2" role="status">{{ m }}</div> }
          @if (error(); as e) { <div class="alert alert-danger py-2" role="alert">{{ e.message }}</div> }

          @if (confirmingPublish()) {
            <div class="alert alert-warning">
              <strong>{{ 'V2.ADMIN.BUILDER.PUBLISH_TITLE' | translate: { version: nextVersion() } }}</strong>
              <p class="mb-2 mt-1">{{ 'V2.ADMIN.BUILDER.PUBLISH_TEXT' | translate }}</p>
              @if (publishedRegistrations() > 0) {
                <p class="mb-2">{{ 'V2.ADMIN.BUILDER.PUBLISH_REGS' | translate: { count: publishedRegistrations(), version: f.publishedVersion?.version } }}</p>
              }
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-brand btn-sm" [disabled]="busy()" (click)="publish()">{{ 'V2.ADMIN.BUILDER.PUBLISH_CONFIRM' | translate }}</button>
                <button type="button" class="btn btn-light btn-sm" (click)="confirmingPublish.set(false)">{{ 'V2.COMMON.CANCEL' | translate }}</button>
              </div>
            </div>
          }

          <!-- Revisión: lo que falta o está mal -->
          @if (reviewItems().length) {
            <div class="fe__review">
              <div class="fw-semibold mb-1"><i class="bi bi-exclamation-triangle"></i> {{ 'V2.ADMIN.BUILDER.REVIEW' | translate: { count: reviewItems().length } }}</div>
              <ul class="list-unstyled mb-0">
                @for (r of reviewItems(); track $index) {
                  <li><button type="button" class="btn btn-link btn-sm p-0 text-start" (click)="goTo(r.stepIndex, r.fieldIndex)">{{ r.text }}</button></li>
                }
              </ul>
            </div>
          }

          <div class="fe__grid">
            <!-- Pasos y campos -->
            <section class="fe__canvas" cdkDropListGroup>
              @if (!s.schema().steps.length) {
                <div class="panel-card text-center py-5">
                  <i class="bi bi-ui-checks-grid fs-1 text-muted"></i>
                  <p class="fw-semibold mt-2 mb-1">{{ 'V2.ADMIN.BUILDER.EMPTY_TITLE' | translate }}</p>
                  <p class="text-muted small">{{ 'V2.ADMIN.BUILDER.EMPTY_TEXT' | translate }}</p>
                  <div class="d-flex flex-wrap gap-2 justify-content-center">
                    <button type="button" class="btn btn-brand" (click)="s.replace(starter())"><i class="bi bi-magic"></i> {{ 'V2.ADMIN.BUILDER.START_BASIC' | translate }}</button>
                    <button type="button" class="btn btn-outline-secondary" (click)="s.addStep()">{{ 'V2.ADMIN.BUILDER.ADD_STEP' | translate }}</button>
                  </div>
                </div>
              }

              @for (step of s.schema().steps; track step.key; let si = $index) {
                <div class="fe__step" [class.fe__step--sel]="s.selection()?.step === si && s.selection()?.field === null">
                  <button type="button" class="fe__step-head" (click)="s.select(si, null)">
                    <span class="fe__step-n">{{ si + 1 }}</span>
                    <span class="flex-grow-1 text-start">{{ step.title | i18n }}</span>
                    <small class="text-muted">{{ step.fields.length }}</small>
                  </button>

                  <div class="fe__fields" cdkDropList [cdkDropListData]="si" (cdkDropListDropped)="drop($event)">
                    @for (field of step.fields; track field.key; let fi = $index) {
                      <div class="fe__field" cdkDrag [cdkDragData]="field" [class.fe__field--sel]="s.selection()?.step === si && s.selection()?.field === fi"
                           [class.fe__field--bad]="hasIssue(si, fi)" (click)="s.select(si, fi)">
                        <span class="fe__handle" cdkDragHandle (click)="$event.stopPropagation()"><i class="bi bi-grip-vertical"></i></span>
                        <i class="bi {{ icon(field.type) }} text-muted"></i>
                        <span class="flex-grow-1 text-truncate">{{ field.label | i18n }}</span>
                        @if (field.required) { <span class="text-danger" [title]="'V2.ADMIN.BUILDER.REQUIRED' | translate">*</span> }
                        @if (field.visible_when) { <i class="bi bi-eye-slash text-muted" [title]="'V2.ADMIN.BUILDER.HAS_CONDITION' | translate"></i> }
                        <small class="fe__type">{{ ('V2.ADMIN.BUILDER.TYPE.' + field.type) | translate }}</small>
                      </div>
                    } @empty {
                      <div class="fe__empty">{{ 'V2.ADMIN.BUILDER.STEP_EMPTY' | translate }}</div>
                    }
                  </div>

                  <div class="fe__add">
                    <button type="button" class="btn btn-sm btn-outline-secondary" (click)="toggleMenu(si)"><i class="bi bi-plus-lg"></i> {{ 'V2.ADMIN.BUILDER.ADD_FIELD' | translate }}</button>
                    @if (menuStep() === si) {
                      <div class="fe__menu">
                        @for (g of groups; track g) {
                          <div class="fe__menu-group">{{ ('V2.ADMIN.BUILDER.GROUP.' + g) | translate }}</div>
                          <div class="fe__menu-grid">
                            @for (t of typesOf(g); track t.type) {
                              <button type="button" class="fe__menu-item" [disabled]="s.isTypeUsed(t.type)" (click)="addField(si, t.type)">
                                <i class="bi {{ t.icon }}"></i> {{ ('V2.ADMIN.BUILDER.TYPE.' + t.type) | translate }}
                              </button>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              @if (s.schema().steps.length) {
                <button type="button" class="btn btn-outline-secondary w-100" (click)="s.addStep()"><i class="bi bi-plus-lg"></i> {{ 'V2.ADMIN.BUILDER.ADD_STEP' | translate }}</button>
              }
            </section>

            <!-- Propiedades -->
            <aside class="fe__props panel-card">
              <app-field-properties [state]="s" [items]="f.items" [locked]="lockedKeys()" />
            </aside>
          </div>
        </div>

        @if (showPreview()) {
          <app-form-preview [schema]="s.schema()" [form]="f" (closed)="showPreview.set(false)" />
        }
      }
    } @else if (error()) {
      <div class="alert alert-danger">{{ error()!.message }}</div>
    } @else {
      <p class="text-muted">{{ 'V2.COMMON.LOADING' | translate }}</p>
    }
  `,
    styles: [`
    .min-w-0 { min-width: 0; }
    .fe__head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 16px; }
    .fe__actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .fe__review { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; font-size: 14px; }
    .fe__review .btn-link { color: #92400e; }
    .fe__grid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: start; }
    .fe__props { position: sticky; top: 72px; max-height: calc(100vh - 96px); overflow-y: auto; }
    @media (max-width: 991px) { .fe__grid { grid-template-columns: 1fr; } .fe__props { position: static; max-height: none; } }
    .fe__canvas { display: flex; flex-direction: column; gap: 12px; }
    .fe__step { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .fe__step--sel { border-color: var(--brand-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-primary) 18%, transparent); }
    .fe__step-head { display: flex; align-items: center; gap: 10px; width: 100%; background: var(--surface-muted); border: 0; border-bottom: 1px solid var(--border);
      padding: 10px 14px; font-weight: 600; cursor: pointer; }
    .fe__step-n { width: 24px; height: 24px; border-radius: 50%; background: var(--brand-primary); color: #fff; font-size: 12px; display: flex; align-items: center; justify-content: center; }
    .fe__fields { min-height: 12px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
    .fe__field { display: flex; align-items: center; gap: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; cursor: pointer; font-size: 14px; }
    .fe__field:hover { border-color: color-mix(in srgb, var(--brand-primary) 50%, #fff); }
    .fe__field--sel { border-color: var(--brand-primary); background: color-mix(in srgb, var(--brand-primary) 6%, #fff); }
    .fe__field--bad { border-color: #f59e0b; }
    .fe__handle { cursor: grab; color: var(--text-muted); padding: 0 2px; }
    .fe__type { color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
    .fe__empty { text-align: center; color: var(--text-muted); font-size: 13px; padding: 10px; border: 1px dashed var(--border); border-radius: 10px; }
    .fe__add { padding: 0 8px 10px; position: relative; }
    .fe__menu { margin-top: 8px; border: 1px solid var(--border); border-radius: 12px; padding: 10px; background: var(--surface); box-shadow: 0 8px 24px rgba(15, 23, 42, .1); }
    .fe__menu-group { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 6px 0 4px; }
    .fe__menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px; }
    .fe__menu-item { display: flex; gap: 8px; align-items: center; text-align: left; background: var(--surface-muted); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: 13px; cursor: pointer; }
    .fe__menu-item:hover:not(:disabled) { border-color: var(--brand-primary); }
    .fe__menu-item:disabled { opacity: .45; cursor: not-allowed; }
    .cdk-drag-preview { box-shadow: 0 8px 24px rgba(15, 23, 42, .2); border-radius: 10px; background: var(--surface); }
    .cdk-drag-placeholder { opacity: .35; }
    .cdk-drag-animating { transition: transform 200ms ease; }
  `],
})
export class FormEditorPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private api = inject(AdminApiService);
    private translate = inject(TranslateService);
    private language = inject(LanguageService);
    readonly context = inject(EventContextService);

    readonly groups = GROUPS;
    eventId = 0;
    formId = 0;

    readonly form = signal<AdminForm | null>(null);
    readonly state = signal<BuilderState | null>(null);
    readonly versions = signal<FormVersionInfo[]>([]);
    readonly busy = signal(false);
    readonly error = signal<ApiError | null>(null);
    readonly message = signal<string | null>(null);
    readonly showPreview = signal(false);
    readonly menuStep = signal<number | null>(null);
    readonly confirmingPublish = signal(false);
    /** Lo que la API dice que falta para publicar (después del último guardado). */
    readonly apiIssues = signal<SchemaIssue[]>([]);

    readonly starter = starterSchema;

    /** Claves que ya existen en la versión publicada. */
    readonly lockedKeys = computed(() => new Set(this.form()?.publishedVersion?.schema.steps.flatMap(s => s.fields.map(f => f.key)) ?? []));
    readonly nextVersion = computed(() => this.form()?.draftVersion?.version ?? (this.form()?.publishedVersion?.version ?? 0) + 1);
    readonly publishedRegistrations = computed(() => {
        const published = this.form()?.publishedVersion?.id;
        return this.versions().find(v => v.id === published)?.registrations ?? 0;
    });

    /** Problemas locales (traducciones, opciones…) y de la API, con texto legible. */
    readonly reviewItems = computed(() => {
        const s = this.state();
        if (!s) return [];
        this.language.currentLang();
        const items: { stepIndex: number | null; fieldIndex: number | null; text: string }[] = [];
        const schema = s.schema();
        const where = (si: number | null, fi: number | null) => {
            if (si === null) return '';
            const step = schema.steps[si];
            const stepName = step ? step.title[this.language.currentLang()] || `#${si + 1}` : `#${si + 1}`;
            const field = fi !== null ? step?.fields[fi] : undefined;
            return field ? `${stepName} › ${field.label[this.language.currentLang()] || field.key}: ` : `${stepName}: `;
        };
        for (const i of s.issues()) {
            items.push({ stepIndex: i.stepIndex, fieldIndex: i.fieldIndex, text: where(i.stepIndex, i.fieldIndex) + this.translate.instant(`V2.ADMIN.BUILDER.ISSUE.${i.code}`) });
        }
        // Lo de la API solo se muestra cuando no hay cambios sin guardar (si no, ya puede estar desactualizado)
        if (!s.dirty()) {
            for (const i of this.apiIssues()) {
                const loc = locatePath(i.path);
                items.push({ stepIndex: loc.stepIndex, fieldIndex: loc.fieldIndex, text: where(loc.stepIndex, loc.fieldIndex) + i.message });
            }
        }
        return items;
    });

    ngOnInit() {
        this.eventId = Number(this.route.pathFromRoot.map(r => r.snapshot.paramMap.get('eventId')).find(Boolean));
        this.formId = Number(this.route.snapshot.paramMap.get('formId'));
        this.load();
    }

    private load() {
        this.error.set(null);
        this.api.form(this.formId).subscribe({
            next: f => this.applyForm(f),
            error: (e: ApiError) => this.error.set(e),
        });
        this.api.formVersions(this.formId).subscribe({ next: v => this.versions.set(v), error: () => undefined });
    }

    private applyForm(f: AdminForm, keepState = false) {
        this.form.set(f);
        const schema: FormSchema = f.draftVersion?.schema ?? f.publishedVersion?.schema ?? { steps: [] };
        const current = this.state();
        if (current && keepState) current.markSaved();
        else this.state.set(new BuilderState(schema));
    }

    // ── Edición ───────────────────────────────────────────────────────

    typesOf(group: Group) { return FIELD_TYPES.filter(t => t.group === group); }
    icon(type: FieldType) { return FIELD_TYPES.find(t => t.type === type)?.icon ?? 'bi-question'; }

    toggleMenu(step: number) { this.menuStep.update(cur => (cur === step ? null : step)); }

    addField(step: number, type: FieldType) {
        this.state()!.addField(step, type);
        this.menuStep.set(null);
    }

    drop(event: CdkDragDrop<number>) {
        const s = this.state()!;
        s.moveField(event.previousContainer.data, event.previousIndex, event.container.data, event.currentIndex);
    }

    goTo(stepIndex: number | null, fieldIndex: number | null) {
        if (stepIndex !== null) this.state()!.select(stepIndex, fieldIndex);
    }

    hasIssue(si: number, fi: number) {
        return this.reviewItems().some(r => r.stepIndex === si && r.fieldIndex === fi);
    }

    // ── Guardar y publicar ────────────────────────────────────────────

    /** Guarda el borrador; si hay algo mal, lo muestra. Devuelve true si quedó guardado. */
    save(after?: () => void) {
        const s = this.state();
        if (!s) return;
        this.busy.set(true);
        this.error.set(null);
        this.message.set(null);
        this.api.saveDraft(this.formId, sanitizeSchema(s.schema())).subscribe({
            next: res => {
                this.busy.set(false);
                s.markSaved();
                this.apiIssues.set(res.publishIssues);
                // El borrador ahora existe en el servidor (con su número de versión)
                this.api.form(this.formId).subscribe({ next: f => this.form.set(f), error: () => undefined });
                this.message.set(this.translate.instant('V2.ADMIN.BUILDER.SAVED'));
                setTimeout(() => this.message.set(null), 3500);
                after?.();
            },
            error: (e: ApiError) => {
                this.busy.set(false);
                const issues = (e.details as { issues?: SchemaIssue[] } | undefined)?.issues;
                if (issues?.length) this.apiIssues.set(issues);
                this.error.set(e);
            },
        });
    }

    startPublish() {
        const s = this.state()!;
        this.confirmingPublish.set(false);
        const proceed = () => {
            if (this.apiIssues().length) { this.error.set({ status: 400, message: this.translate.instant('V2.ADMIN.BUILDER.CANNOT_PUBLISH') }); return; }
            this.confirmingPublish.set(true);
        };
        // Primero se guarda (así la API dice qué falta); si no hay cambios se pasa directo a confirmar
        if (s.dirty()) this.save(proceed); else proceed();
    }

    publish() {
        this.busy.set(true);
        this.error.set(null);
        this.api.publishForm(this.formId).subscribe({
            next: f => {
                this.busy.set(false);
                this.confirmingPublish.set(false);
                this.applyForm(f, true);
                this.apiIssues.set([]);
                this.api.formVersions(this.formId).subscribe({ next: v => this.versions.set(v), error: () => undefined });
                this.message.set(this.translate.instant('V2.ADMIN.BUILDER.PUBLISHED'));
                setTimeout(() => this.message.set(null), 4000);
            },
            error: (e: ApiError) => {
                this.busy.set(false);
                this.confirmingPublish.set(false);
                const issues = (e.details as { issues?: SchemaIssue[] } | undefined)?.issues;
                if (issues?.length) this.apiIssues.set(issues);
                this.error.set(e);
            },
        });
    }

    discard() {
        const f = this.form();
        if (!f || !window.confirm(this.translate.instant('V2.ADMIN.BUILDER.DISCARD_CONFIRM'))) return;
        this.apiIssues.set([]);
        this.state.set(new BuilderState(f.draftVersion?.schema ?? f.publishedVersion?.schema ?? { steps: [] }));
    }

    // ── Salir con cambios sin guardar ─────────────────────────────────

    confirmLeave(): boolean {
        return !this.state()?.dirty() || window.confirm(this.translate.instant('V2.ADMIN.BUILDER.LEAVE_CONFIRM'));
    }

    @HostListener('window:beforeunload', ['$event'])
    onBeforeUnload(event: BeforeUnloadEvent) {
        if (this.state()?.dirty()) event.preventDefault();
    }
}

