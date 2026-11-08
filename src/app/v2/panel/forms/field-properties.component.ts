import { Component, Input, computed, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { I18nPipe } from '../../core/i18n';
import { Condition, FormField, FormOption, OptionValue } from '../../public/public.models';
import { AdminItem } from './builder.models';
import { BuilderState } from './builder-state';
import { GENDER_OPTIONS, MAPS_TO, conditionChoices, fieldsBefore, hasOptions, slugKey } from './schema-utils';

type Lang = 'es' | 'en';
type Operator = 'equals' | 'not_equals' | 'in';

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Panel de propiedades: del campo seleccionado (o del paso, si no hay campo). */
@Component({
    selector: 'app-field-properties',
    standalone: true,
    imports: [TranslateModule, I18nPipe],
    template: `
    @if (state.selection(); as sel) {
      @if (state.selectedField(); as f) {
        <div class="fpp">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="fpp__title"><i class="bi {{ icon(f) }}"></i> {{ ('V2.ADMIN.BUILDER.TYPE.' + f.type) | translate }}</h2>
            <div class="btn-group btn-group-sm">
              <button type="button" class="btn btn-outline-secondary" [disabled]="sel.field === 0 && sel.step === 0" [title]="'V2.ADMIN.BUILDER.MOVE_UP' | translate" (click)="moveField(-1)"><i class="bi bi-arrow-up"></i></button>
              <button type="button" class="btn btn-outline-secondary" [title]="'V2.ADMIN.BUILDER.MOVE_DOWN' | translate" (click)="moveField(1)"><i class="bi bi-arrow-down"></i></button>
              <button type="button" class="btn btn-outline-danger" [title]="'V2.ADMIN.BUILDER.DELETE_FIELD' | translate" (click)="state.removeField(sel.step, sel.field!)"><i class="bi bi-trash"></i></button>
            </div>
          </div>

          <!-- Texto -->
          <div class="row g-2 mb-3">
              <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.LABEL' | translate }} (ES)</label>
                <input class="form-control" maxlength="500" [value]="f.label.es" (input)="setLabel('es', $any($event.target).value)" [class.is-invalid]="!f.label.es.trim()" /></div>
              <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.LABEL' | translate }} (EN)</label>
                <input class="form-control" maxlength="500" [value]="f.label.en" (input)="setLabel('en', $any($event.target).value)" [class.is-invalid]="!f.label.en.trim()" /></div>
              <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.HELP' | translate }} (ES)</label>
                <input class="form-control" maxlength="500" [value]="f.help?.es ?? ''" (input)="setHelp('es', $any($event.target).value)" /></div>
              <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.HELP' | translate }} (EN)</label>
                <input class="form-control" maxlength="500" [value]="f.help?.en ?? ''" (input)="setHelp('en', $any($event.target).value)" /></div>
            </div>

          <label class="fpp__check mb-3">
            <input type="checkbox" class="form-check-input" [checked]="!!f.required" (change)="patch({ required: $any($event.target).checked })" />
            <span>{{ 'V2.ADMIN.BUILDER.REQUIRED' | translate }}</span>
          </label>

          <!-- Clave interna -->
          <div class="mb-3">
            <label class="form-label small">{{ 'V2.ADMIN.BUILDER.KEY' | translate }}</label>
            <input class="form-control form-control-sm font-monospace" [value]="keyDraft(f)" [disabled]="locked.has(f.key)"
                   (input)="keyText.set($any($event.target).value)" (blur)="commitKey()" (keydown.enter)="commitKey()" [class.is-invalid]="!!keyError()" />
            @if (keyError()) { <div class="small text-danger mt-1">{{ 'V2.ADMIN.BUILDER.KEY_INVALID' | translate }}</div> }
            @else if (locked.has(f.key)) { <div class="small text-muted mt-1">{{ 'V2.ADMIN.BUILDER.KEY_LOCKED' | translate }}</div> }
            @else { <div class="small text-muted mt-1">{{ 'V2.ADMIN.BUILDER.KEY_HINT' | translate }}</div> }
          </div>

          <!-- Dato de la persona que llena -->
          @if (mapsOptions(f).length) {
            <div class="mb-3">
              <label class="form-label small">{{ 'V2.ADMIN.BUILDER.MAPS_TO' | translate }}</label>
              <select class="form-select form-select-sm" (change)="setMapsTo($any($event.target).value)">
                <option value="" [selected]="!f.maps_to">{{ 'V2.ADMIN.BUILDER.MAPS_NONE' | translate }}</option>
                @for (m of mapsOptions(f); track m) {
                  <option [value]="m" [selected]="f.maps_to === m" [disabled]="mapsUsedByOther(m)">{{ ('V2.ADMIN.BUILDER.MAPS.' + m) | translate }}</option>
                }
              </select>
              <div class="small text-muted mt-1">{{ 'V2.ADMIN.BUILDER.MAPS_HINT' | translate }}</div>
            </div>
          }

          <!-- Por tipo -->
          @switch (f.type) {
            @case ('text') {
              <div class="row g-2 mb-3">
                <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.MIN_LENGTH' | translate }}</label>
                  <input type="number" min="0" max="500" class="form-control form-control-sm" [value]="f.min_length ?? ''" (input)="patchNumber('min_length', $any($event.target).value)" /></div>
                <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.MAX_LENGTH' | translate }}</label>
                  <input type="number" min="1" max="500" class="form-control form-control-sm" [value]="f.max_length ?? 200" (input)="patchNumber('max_length', $any($event.target).value)" /></div>
              </div>
            }
            @case ('textarea') {
              <div class="mb-3"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.MAX_LENGTH' | translate }}</label>
                <input type="number" min="1" max="2000" class="form-control form-control-sm" [value]="f.max_length ?? 1000" (input)="patchNumber('max_length', $any($event.target).value)" /></div>
            }
            @case ('number') {
              <div class="row g-2 mb-3">
                <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.MIN' | translate }}</label>
                  <input type="number" class="form-control form-control-sm" [value]="f.min ?? ''" (input)="patchNumber('min', $any($event.target).value)" /></div>
                <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.MAX' | translate }}</label>
                  <input type="number" class="form-control form-control-sm" [value]="f.max ?? ''" (input)="patchNumber('max', $any($event.target).value)" /></div>
                <div class="col-12"><label class="fpp__check"><input type="checkbox" class="form-check-input" [checked]="!!f.integer" (change)="patch({ integer: $any($event.target).checked })" />
                  <span>{{ 'V2.ADMIN.BUILDER.INTEGER' | translate }}</span></label></div>
              </div>
            }
            @case ('date') {
              <div class="row g-2 mb-3">
                <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.MIN_DATE' | translate }}</label>
                  <input type="date" class="form-control form-control-sm" [value]="f.min ?? ''" (input)="patchText('min', $any($event.target).value)" /></div>
                <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.MAX_DATE' | translate }}</label>
                  <input type="date" class="form-control form-control-sm" [value]="f.max ?? ''" (input)="patchText('max', $any($event.target).value)" /></div>
              </div>
            }
            @case ('checkbox_group') {
              <div class="row g-2 mb-3">
                <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.MIN_SELECTED' | translate }}</label>
                  <input type="number" min="0" class="form-control form-control-sm" [value]="f.min_selected ?? ''" (input)="patchNumber('min_selected', $any($event.target).value)" /></div>
                <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.MAX_SELECTED' | translate }}</label>
                  <input type="number" min="1" class="form-control form-control-sm" [value]="f.max_selected ?? ''" (input)="patchNumber('max_selected', $any($event.target).value)" /></div>
              </div>
            }
            @case ('church_picker') {
              <label class="fpp__check mb-3"><input type="checkbox" class="form-check-input" [checked]="f.allow_new !== false" (change)="patch({ allow_new: $any($event.target).checked })" />
                <span>{{ 'V2.ADMIN.BUILDER.ALLOW_NEW' | translate }}</span></label>
            }
            @case ('state_conference_picker') { <p class="small text-muted">{{ 'V2.ADMIN.BUILDER.SYSTEM_HINT' | translate }}</p> }
            @case ('city_picker') { <p class="small text-muted">{{ 'V2.ADMIN.BUILDER.CITY_HINT' | translate }}</p> }
          }

          @if (f.type === 'item_toggle' || f.type === 'item_variant') {
            <div class="mb-3">
              <label class="form-label small">{{ 'V2.ADMIN.BUILDER.PRODUCT' | translate }}</label>
              <select class="form-select form-select-sm" [class.is-invalid]="!f.item" (change)="patch({ item: $any($event.target).value })">
                <option value="" [selected]="!f.item">{{ 'V2.COMMON.SELECT' | translate }}</option>
                @for (it of itemChoices(f); track it.code) {
                  <option [value]="it.code" [selected]="f.item === it.code">{{ it.name | i18n }} ({{ it.code }})</option>
                }
              </select>
              @if (!itemChoices(f).length) { <div class="small text-warning mt-1">{{ 'V2.ADMIN.BUILDER.NO_PRODUCTS' | translate }}</div> }
            </div>
          }

          <!-- Opciones -->
          @if (isList(f)) {
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <label class="form-label small mb-0">{{ 'V2.ADMIN.BUILDER.OPTIONS' | translate }}</label>
                @if (f.maps_to === 'gender') {
                  <button type="button" class="btn btn-link btn-sm p-0" (click)="useGenderOptions()">{{ 'V2.ADMIN.BUILDER.USE_GENDER' | translate }}</button>
                }
              </div>
              @for (o of f.options ?? []; track $index) {
                <div class="fpp__option">
                  <div class="fpp__option-fields">
                    <input class="form-control form-control-sm" placeholder="ES" [value]="o.label.es" (input)="setOptionLabel($index, 'es', $any($event.target).value)" [class.is-invalid]="!o.label.es.trim()" />
                    <input class="form-control form-control-sm" placeholder="EN" [value]="o.label.en" (input)="setOptionLabel($index, 'en', $any($event.target).value)" [class.is-invalid]="!o.label.en.trim()" />
                    <input class="form-control form-control-sm font-monospace" [placeholder]="'V2.ADMIN.BUILDER.OPTION_VALUE' | translate" [value]="o.value"
                           [disabled]="f.maps_to === 'gender'" (input)="setOptionValue($index, $any($event.target).value)" />
                  </div>
                  <div class="btn-group-vertical btn-group-sm">
                    <button type="button" class="btn btn-outline-secondary" [disabled]="$first" (click)="moveOption($index, -1)" [attr.aria-label]="'V2.ADMIN.BUILDER.MOVE_UP' | translate"><i class="bi bi-chevron-up"></i></button>
                    <button type="button" class="btn btn-outline-secondary" [disabled]="$last" (click)="moveOption($index, 1)" [attr.aria-label]="'V2.ADMIN.BUILDER.MOVE_DOWN' | translate"><i class="bi bi-chevron-down"></i></button>
                  </div>
                  <button type="button" class="btn btn-sm btn-outline-danger" (click)="removeOption($index)" [attr.aria-label]="'V2.ADMIN.BUILDER.DELETE_OPTION' | translate"><i class="bi bi-x-lg"></i></button>
                </div>
              }
              <button type="button" class="btn btn-sm btn-outline-secondary mt-1" (click)="addOption()"><i class="bi bi-plus-lg"></i> {{ 'V2.ADMIN.BUILDER.ADD_OPTION' | translate }}</button>
            </div>
          }

          <!-- Condición -->
          <div class="fpp__cond">
            <label class="form-label small">{{ 'V2.ADMIN.BUILDER.SHOW_IF' | translate }}</label>
            <select class="form-select form-select-sm mb-2" (change)="setConditionField($any($event.target).value)">
              <option value="" [selected]="!f.visible_when">{{ 'V2.ADMIN.BUILDER.ALWAYS' | translate }}</option>
              @for (b of before(); track b.key) { <option [value]="b.key" [selected]="f.visible_when?.field === b.key">{{ b.label | i18n }} ({{ b.key }})</option> }
            </select>
            @if (f.visible_when; as c) {
              <div class="d-flex gap-2 mb-2">
                <select class="form-select form-select-sm w-auto" (change)="setOperator($any($event.target).value)">
                  @for (op of operators; track op) { <option [value]="op" [selected]="operatorOf(c) === op">{{ ('V2.ADMIN.BUILDER.OP.' + op) | translate }}</option> }
                </select>
                @if (choices(c); as list) {
                  @if (operatorOf(c) !== 'in') {
                    <select class="form-select form-select-sm" (change)="setSingleValue($any($event.target).value)">
                      <option value="" [selected]="currentIndex(c, list) < 0">{{ 'V2.COMMON.SELECT' | translate }}</option>
                      @for (ch of list; track $index) { <option [value]="$index" [selected]="currentIndex(c, list) === $index">{{ ch.label | i18n }}</option> }
                    </select>
                  }
                } @else if (operatorOf(c) !== 'in') {
                  <input class="form-control form-control-sm" [value]="singleValue(c)" (input)="setFreeValue($any($event.target).value)" />
                }
              </div>
              @if (operatorOf(c) === 'in') {
                @if (choices(c); as list) {
                  @for (ch of list; track $index) {
                    <label class="fpp__check"><input type="checkbox" class="form-check-input" [checked]="isIn(c, ch.value)" (change)="toggleIn(ch.value)" />
                      <span>{{ ch.label | i18n }}</span></label>
                  }
                } @else {
                  <input class="form-control form-control-sm" [placeholder]="'V2.ADMIN.BUILDER.IN_HINT' | translate" [value]="inValues(c).join(', ')" (input)="setInText($any($event.target).value)" />
                }
              }
              <div class="small text-muted">{{ 'V2.ADMIN.BUILDER.SHOW_IF_HINT' | translate }}</div>
            }
          </div>
        </div>
      } @else {
       @if (state.selectedStep(); as st) {
        <div class="fpp">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="fpp__title"><i class="bi bi-layers"></i> {{ 'V2.ADMIN.BUILDER.STEP' | translate }}</h2>
            <div class="btn-group btn-group-sm">
              <button type="button" class="btn btn-outline-secondary" [disabled]="sel.step === 0" [title]="'V2.ADMIN.BUILDER.MOVE_UP' | translate" (click)="state.moveStep(sel.step, sel.step - 1)"><i class="bi bi-arrow-up"></i></button>
              <button type="button" class="btn btn-outline-secondary" [disabled]="sel.step >= state.schema().steps.length - 1" [title]="'V2.ADMIN.BUILDER.MOVE_DOWN' | translate" (click)="state.moveStep(sel.step, sel.step + 1)"><i class="bi bi-arrow-down"></i></button>
              <button type="button" class="btn btn-outline-danger" [title]="'V2.ADMIN.BUILDER.DELETE_STEP' | translate" (click)="state.removeStep(sel.step)"><i class="bi bi-trash"></i></button>
            </div>
          </div>
          <div class="row g-2">
            <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.TITLE' | translate }} (ES)</label>
              <input class="form-control" maxlength="500" [value]="st.title.es" (input)="setStepText('title', 'es', $any($event.target).value)" [class.is-invalid]="!st.title.es.trim()" /></div>
            <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.TITLE' | translate }} (EN)</label>
              <input class="form-control" maxlength="500" [value]="st.title.en" (input)="setStepText('title', 'en', $any($event.target).value)" [class.is-invalid]="!st.title.en.trim()" /></div>
            <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.DESCRIPTION' | translate }} (ES)</label>
              <input class="form-control" maxlength="500" [value]="st.description?.es ?? ''" (input)="setStepText('description', 'es', $any($event.target).value)" /></div>
            <div class="col-6"><label class="form-label small">{{ 'V2.ADMIN.BUILDER.DESCRIPTION' | translate }} (EN)</label>
              <input class="form-control" maxlength="500" [value]="st.description?.en ?? ''" (input)="setStepText('description', 'en', $any($event.target).value)" /></div>
          </div>
        </div>
       }
      }
    } @else {
      <p class="text-muted small p-3 mb-0">{{ 'V2.ADMIN.BUILDER.SELECT_HINT' | translate }}</p>
    }
  `,
    styles: [`
    .fpp__title { font-size: 15px; font-weight: 700; margin: 0; display: flex; gap: 8px; align-items: center; }
    .fpp__check { display: flex; gap: 8px; align-items: center; cursor: pointer; margin: 0; font-size: 14px; }
    .fpp__option { display: flex; gap: 6px; align-items: flex-start; margin-bottom: 8px; }
    .fpp__option-fields { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    .fpp__option-fields input:last-child { grid-column: 1 / -1; }
    .fpp__cond { border-top: 1px solid var(--border); padding-top: 14px; }
  `],
})
export class FieldPropertiesComponent {
    @Input({ required: true }) state!: BuilderState;
    @Input() items: AdminItem[] = [];
    /** Claves que ya están en la versión publicada: cambiarlas rompería los datos anteriores. */
    @Input() locked: ReadonlySet<string> = new Set();

    readonly operators: Operator[] = ['equals', 'not_equals', 'in'];
    readonly keyText = signal<string | null>(null);
    readonly keyError = signal(false);

    private sel() { return this.state.selection()!; }
    private field() { return this.state.selectedField()!; }

    readonly before = computed(() => {
        const sel = this.state.selection();
        return sel && sel.field !== null ? fieldsBefore(this.state.schema(), sel.step, sel.field) : [];
    });

    icon(f: FormField) { return ({ text: 'bi-fonts', textarea: 'bi-text-paragraph', email: 'bi-envelope', phone: 'bi-telephone', number: 'bi-123', date: 'bi-calendar-date',
        checkbox: 'bi-check-square', consent: 'bi-patch-check', radio: 'bi-ui-radios', select: 'bi-menu-button-wide', checkbox_group: 'bi-ui-checks',
        state_conference_picker: 'bi-geo-alt', church_picker: 'bi-building', city_picker: 'bi-pin-map', item_toggle: 'bi-bag-plus', item_variant: 'bi-rulers' } as Record<string, string>)[f.type]; }

    isList(f: FormField) { return hasOptions(f.type); }

    // ── Cambios simples ───────────────────────────────────────────────

    patch(p: Partial<FormField>) { this.state.updateField(this.sel().step, this.sel().field!, p); }

    setLabel(lang: Lang, text: string) {
        const f = this.field();
        const wasAuto = this.keyIsAuto(f);
        this.patch({ label: { ...f.label, [lang]: text } });
        // Mientras la clave no se haya tocado y el campo sea nuevo, sigue al nombre en español
        if (lang === 'es' && wasAuto && !this.locked.has(f.key)) this.autoKey(text);
    }

    setHelp(lang: Lang, text: string) {
        const f = this.field();
        const help = { es: f.help?.es ?? '', en: f.help?.en ?? '', [lang]: text };
        this.patch({ help: help.es || help.en ? help : undefined });
    }

    patchNumber(key: 'min_length' | 'max_length' | 'min' | 'max' | 'min_selected' | 'max_selected', text: string) {
        const n = text === '' ? undefined : Number(text);
        this.patch({ [key]: n !== undefined && Number.isFinite(n) ? n : undefined } as Partial<FormField>);
    }

    patchText(key: 'min' | 'max', text: string) { this.patch({ [key]: text || undefined } as Partial<FormField>); }

    moveField(delta: number) {
        const sel = this.sel();
        const steps = this.state.schema().steps;
        const index = sel.field!;
        if (delta < 0) {
            if (index > 0) this.state.moveField(sel.step, index, sel.step, index - 1);
            else if (sel.step > 0) this.state.moveField(sel.step, index, sel.step - 1, steps[sel.step - 1].fields.length);
        } else if (index < steps[sel.step].fields.length - 1) this.state.moveField(sel.step, index, sel.step, index + 1);
        else if (sel.step < steps.length - 1) this.state.moveField(sel.step, index, sel.step + 1, 0);
    }

    // ── Clave ─────────────────────────────────────────────────────────

    keyDraft(f: FormField) { return this.keyText() ?? f.key; }

    /** La clave todavía es la que se generó sola a partir del nombre. */
    private keyIsAuto(f: FormField) {
        const taken = new Set(this.state.schema().steps.flatMap(s => s.fields.map(x => x.key)).filter(k => k !== f.key));
        return f.key === slugKey(f.label.es, taken) || f.key === slugKey(f.label.es, new Set());
    }

    private autoKey(label: string) {
        const sel = this.sel();
        const f = this.field();
        const taken = new Set(this.state.schema().steps.flatMap(s => s.fields.map(x => x.key)).filter(k => k !== f.key));
        this.state.renameField(sel.step, sel.field!, slugKey(label, taken));
    }

    commitKey() {
        const text = this.keyText();
        this.keyText.set(null);
        if (text === null) return;
        const sel = this.sel();
        const ok = this.state.renameField(sel.step, sel.field!, text.trim());
        this.keyError.set(!ok);
        if (!ok) setTimeout(() => this.keyError.set(false), 3000);
    }

    // ── Dato de la persona ────────────────────────────────────────────

    mapsOptions(f: FormField) { return MAPS_TO[f.type] ?? []; }

    mapsUsedByOther(value: string) {
        const f = this.field();
        return this.state.schema().steps.some(s => s.fields.some(x => x.key !== f.key && x.maps_to === value));
    }

    setMapsTo(value: string) {
        const f = this.field();
        this.patch({ maps_to: value || undefined });
        if (value === 'gender') this.useGenderOptions();
        else if (f.maps_to === 'gender' && !value) { /* conserva las opciones */ }
    }

    // ── Productos ─────────────────────────────────────────────────────

    itemChoices(f: FormField) {
        return this.items.filter(i => i.isActive && (f.type === 'item_toggle' || i.variants.some(v => v.isActive)));
    }

    // ── Opciones ──────────────────────────────────────────────────────

    private options(): FormOption[] { return [...(this.field().options ?? [])]; }
    private setOptions(options: FormOption[]) { this.patch({ options }); }

    addOption() {
        const options = this.options();
        const n = options.length + 1;
        const taken = new Set(options.map(o => String(o.value)));
        this.setOptions([...options, { value: slugKey(`opcion ${n}`, taken, 'opcion'), label: { es: `Opción ${n}`, en: `Option ${n}` } }]);
    }

    removeOption(i: number) { this.setOptions(this.options().filter((_, idx) => idx !== i)); }

    moveOption(i: number, delta: number) {
        const options = this.options();
        const to = i + delta;
        if (to < 0 || to >= options.length) return;
        [options[i], options[to]] = [options[to], options[i]];
        this.setOptions(options);
    }

    setOptionLabel(i: number, lang: Lang, text: string) {
        const f = this.field();
        const options = this.options();
        const current = options[i];
        const next: FormOption = { ...current, label: { ...current.label, [lang]: text } };
        // El valor sigue al texto en español mientras sea uno generado (opcion_1 o el nombre de antes)
        if (lang === 'es' && f.maps_to !== 'gender' && typeof current.value === 'string') {
            const auto = current.value.startsWith('opcion_') || current.value === slugKey(current.label.es, new Set(), 'opcion');
            if (auto && text.trim()) {
                const taken = new Set(options.filter((_, idx) => idx !== i).map(o => String(o.value)));
                next.value = slugKey(text, taken, 'opcion');
            }
        }
        options[i] = next;
        this.setOptions(options);
    }

    setOptionValue(i: number, text: string) {
        const options = this.options();
        options[i] = { ...options[i], value: text };
        this.setOptions(options);
    }

    useGenderOptions() { this.setOptions(GENDER_OPTIONS.map(o => ({ value: o.value, label: { ...o.label } }))); }

    // ── Condición ─────────────────────────────────────────────────────

    private refField(c: Condition) { return this.before().find(b => b.key === c.field) ?? null; }

    choices(c: Condition) {
        const ref = this.refField(c);
        return ref ? conditionChoices(ref) : null;
    }

    operatorOf(c: Condition): Operator { return c.in !== undefined ? 'in' : c.not_equals !== undefined ? 'not_equals' : 'equals'; }

    isIn(c: Condition, value: OptionValue) { return (c.in ?? []).some(v => sameValue(v, value)); }
    inValues(c: Condition): OptionValue[] { return c.in ?? []; }
    singleValue(c: Condition) { const v = c.equals ?? c.not_equals; return v === undefined ? '' : String(v); }
    currentIndex(c: Condition, list: { value: OptionValue }[]) {
        const v = c.equals ?? c.not_equals;
        return v === undefined ? -1 : list.findIndex(x => sameValue(x.value, v));
    }

    private setCondition(c: Condition | undefined) { this.patch({ visible_when: c }); }

    setConditionField(key: string) {
        this.setCondition(key ? { field: key } : undefined);
    }

    setOperator(op: Operator) {
        const c = this.field().visible_when;
        if (!c) return;
        const values = c.in ?? (c.equals !== undefined ? [c.equals] : c.not_equals !== undefined ? [c.not_equals] : []);
        if (op === 'in') this.setCondition({ field: c.field, ...(values.length ? { in: values } : { in: [] }) });
        else this.setCondition({ field: c.field, ...(values.length ? { [op]: values[0] } : {}) } as Condition);
    }

    setSingleValue(index: string) {
        const c = this.field().visible_when;
        if (!c) return;
        const list = this.choices(c);
        const op = this.operatorOf(c) === 'not_equals' ? 'not_equals' : 'equals';
        this.setCondition(index === '' || !list ? { field: c.field } : { field: c.field, [op]: list[Number(index)].value } as Condition);
    }

    setFreeValue(text: string) {
        const c = this.field().visible_when;
        if (!c) return;
        const op = this.operatorOf(c) === 'not_equals' ? 'not_equals' : 'equals';
        this.setCondition(text.trim() === '' ? { field: c.field } : { field: c.field, [op]: this.parse(c, text.trim()) } as Condition);
    }

    toggleIn(value: OptionValue) {
        const c = this.field().visible_when;
        if (!c) return;
        const current = this.inValues(c);
        const next = current.some(v => sameValue(v, value)) ? current.filter(v => !sameValue(v, value)) : [...current, value];
        this.setCondition({ field: c.field, in: next });
    }

    setInText(text: string) {
        const c = this.field().visible_when;
        if (!c) return;
        this.setCondition({ field: c.field, in: text.split(',').map(t => t.trim()).filter(Boolean).map(t => this.parse(c, t)) });
    }

    /** En un campo de número, la condición compara números. */
    private parse(c: Condition, text: string): OptionValue {
        return this.refField(c)?.type === 'number' && text !== '' && !Number.isNaN(Number(text)) ? Number(text) : text;
    }

    // ── Paso ──────────────────────────────────────────────────────────

    setStepText(key: 'title' | 'description', lang: Lang, text: string) {
        const step = this.state.selectedStep()!;
        const current = (key === 'title' ? step.title : step.description) ?? { es: '', en: '' };
        const next = { ...current, [lang]: text };
        this.state.updateStep(this.sel().step, { [key]: key === 'description' && !next.es && !next.en ? undefined : next });
    }
}
