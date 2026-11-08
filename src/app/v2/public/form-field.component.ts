import { NgTemplateOutlet } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../core/services/language.service';
import { I18nPipe, formatMoney } from '../core/i18n';
import { ChurchValue, FieldError, LocationValue, canonicalCity } from './form-engine';
import { FormState } from './form-state';
import { FormField, FormOption, PublicItem } from './public.models';

const NEW_CHURCH = '__new__';

/** Dibuja un campo del formulario según su tipo y lo conecta con el estado. */
@Component({
    selector: 'app-form-field',
    standalone: true,
    imports: [NgTemplateOutlet, TranslateModule, I18nPipe],
    template: `
    <div class="ff" [class.ff--invalid]="!!error()">
      @switch (field.type) {

        @case ('text') {
          <ng-container *ngTemplateOutlet="labelTpl" />
          <input [id]="id" type="text" class="form-control" [class.is-invalid]="!!error()" [value]="str()"
                 [attr.autocomplete]="autocomplete" [attr.maxlength]="field.max_length ?? 200"
                 (input)="set($any($event.target).value)" (blur)="blur()" />
        }
        @case ('textarea') {
          <ng-container *ngTemplateOutlet="labelTpl" />
          <textarea [id]="id" rows="3" class="form-control" [class.is-invalid]="!!error()" [value]="str()"
                    [attr.maxlength]="field.max_length ?? 1000"
                    (input)="set($any($event.target).value)" (blur)="blur()"></textarea>
        }
        @case ('email') {
          <ng-container *ngTemplateOutlet="labelTpl" />
          <input [id]="id" type="email" inputmode="email" autocomplete="email" class="form-control" [class.is-invalid]="!!error()"
                 [value]="str()" (input)="set($any($event.target).value)" (blur)="blur()" />
        }
        @case ('phone') {
          <ng-container *ngTemplateOutlet="labelTpl" />
          <input [id]="id" type="tel" inputmode="tel" autocomplete="tel" class="form-control" [class.is-invalid]="!!error()"
                 [value]="str()" (input)="set($any($event.target).value)" (blur)="blur()" />
        }
        @case ('number') {
          <ng-container *ngTemplateOutlet="labelTpl" />
          <input [id]="id" type="number" inputmode="decimal" class="form-control" [class.is-invalid]="!!error()"
                 [attr.min]="field.min" [attr.max]="field.max" [value]="str()"
                 (input)="set($any($event.target).value)" (blur)="blur()" />
        }
        @case ('date') {
          <ng-container *ngTemplateOutlet="labelTpl" />
          <input [id]="id" type="date" class="form-control" [class.is-invalid]="!!error()" [value]="str()"
                 [attr.autocomplete]="field.maps_to === 'birth_date' ? 'bday' : null"
                 [attr.min]="field.min" [attr.max]="field.maps_to === 'birth_date' ? today : field.max"
                 (input)="set($any($event.target).value)" (blur)="blur()" />
        }

        @case ('checkbox') { <ng-container *ngTemplateOutlet="checkTpl" /> }
        @case ('consent') { <ng-container *ngTemplateOutlet="checkTpl" /> }
        @case ('item_toggle') { <ng-container *ngTemplateOutlet="checkTpl" /> }

        @case ('radio') {
          <fieldset>
            <legend class="form-label">{{ field.label | i18n }}</legend>
            <div class="ff__options">
              @for (opt of field.options ?? []; track $index) {
                <label class="ff__option" [class.ff__option--on]="isChosen(opt)">
                  <input type="radio" class="form-check-input" [name]="id" [checked]="isChosen(opt)"
                         (change)="set(opt.value); blur()" />
                  <span>{{ opt.label | i18n }}</span>
                </label>
              }
            </div>
          </fieldset>
        }
        @case ('checkbox_group') {
          <fieldset>
            <legend class="form-label">{{ field.label | i18n }}</legend>
            <div class="ff__options">
              @for (opt of field.options ?? []; track $index) {
                <label class="ff__option" [class.ff__option--on]="inGroup(opt)">
                  <input type="checkbox" class="form-check-input" [checked]="inGroup(opt)" (change)="toggleGroup(opt); blur()" />
                  <span>{{ opt.label | i18n }}</span>
                </label>
              }
            </div>
          </fieldset>
        }
        @case ('select') {
          <ng-container *ngTemplateOutlet="labelTpl" />
          <select [id]="id" class="form-select" [class.is-invalid]="!!error()" (change)="onSelect($any($event.target).value)" (blur)="blur()">
            <option value="" [selected]="isEmptyValue()">{{ 'V2.PUBLIC.FORM.SELECT' | translate }}</option>
            @for (opt of field.options ?? []; track $index) {
              <option [value]="$index" [selected]="isChosen(opt)">{{ opt.label | i18n }}</option>
            }
          </select>
        }

        @case ('state_conference_picker') {
          <div class="row g-3">
            <div class="col-12 col-md-6">
              <label class="form-label" [for]="id + '-state'">{{ 'V2.PUBLIC.FORM.STATE' | translate }}</label>
              <select [id]="id + '-state'" class="form-select" [class.is-invalid]="!!error() && !location().state"
                      (change)="onState($any($event.target).value)" (blur)="blur()">
                <option value="" [selected]="!location().state">{{ 'V2.PUBLIC.FORM.SELECT' | translate }}</option>
                @for (s of state.locations(); track s.code) {
                  <option [value]="s.code" [selected]="s.code === location().state">{{ s.name }}</option>
                }
              </select>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label" [for]="id + '-conf'">{{ 'V2.PUBLIC.FORM.CONFERENCE' | translate }}</label>
              <select [id]="id + '-conf'" class="form-select" [class.is-invalid]="!!error() && !location().conference_id"
                      [disabled]="!location().state" (change)="onConference($any($event.target).value)" (blur)="blur()">
                <option value="" [selected]="!location().conference_id">{{ 'V2.PUBLIC.FORM.SELECT' | translate }}</option>
                @for (c of conferences(); track c.id) {
                  <option [value]="c.id" [selected]="c.id === location().conference_id">{{ c.name }}</option>
                }
              </select>
            </div>
          </div>
        }

        @case ('church_picker') {
          <ng-container *ngTemplateOutlet="labelTpl" />
          @if (!state.conferenceId()) {
            <select class="form-select" disabled [id]="id"><option>{{ 'V2.PUBLIC.FORM.CHURCH_NEED_CONFERENCE' | translate }}</option></select>
          } @else if (state.churches() === 'loading' || state.churches() === null) {
            <select class="form-select" disabled [id]="id"><option>{{ 'V2.PUBLIC.FORM.CHURCH_LOADING' | translate }}</option></select>
          } @else if (state.churches() === 'error') {
            <div class="alert alert-warning py-2 small mb-0">
              {{ 'V2.PUBLIC.FORM.CHURCH_ERROR' | translate }}
              <button type="button" class="btn btn-link btn-sm p-0 ms-1" (click)="state.loadChurches(state.conferenceId()!, true)">{{ 'V2.COMMON.RETRY' | translate }}</button>
            </div>
          } @else if (notListed()) {
            <input [id]="id" type="text" class="form-control" [class.is-invalid]="!!error()" maxlength="200"
                   [placeholder]="'V2.PUBLIC.FORM.CHURCH_NAME' | translate" [value]="church()?.new_name ?? ''"
                   (input)="setChurch({ new_name: $any($event.target).value })" (blur)="blur()" />
            <button type="button" class="btn btn-link btn-sm p-0 mt-1" (click)="setChurch(undefined)">{{ 'V2.PUBLIC.FORM.CHURCH_PICK_LIST' | translate }}</button>
          } @else {
            <select [id]="id" class="form-select" [class.is-invalid]="!!error()" (change)="onChurch($any($event.target).value)" (blur)="blur()">
              <option value="" [selected]="!church()?.church_id">{{ 'V2.PUBLIC.FORM.SELECT' | translate }}</option>
              @for (c of churchList(); track c.id) {
                <option [value]="c.id" [selected]="c.id === church()?.church_id">{{ c.name }}</option>
              }
              @if (field.allow_new !== false) {
                <option [value]="newChurch">— {{ 'V2.PUBLIC.FORM.CHURCH_NOT_LISTED' | translate }} —</option>
              }
            </select>
          }
        }

        @case ('city_picker') {
          <ng-container *ngTemplateOutlet="labelTpl" />
          @if (!state.stateCode()) {
            <input [id]="id" type="text" class="form-control" disabled [placeholder]="'V2.PUBLIC.FORM.CITY_NEED_STATE' | translate" />
          } @else {
            <input [id]="id" type="text" class="form-control" [class.is-invalid]="!!error()" [value]="str()"
                   maxlength="120" autocomplete="off" [attr.list]="id + '-list'"
                   [placeholder]="(state.cities()?.length ? 'V2.PUBLIC.FORM.CITY_PICK' : 'V2.PUBLIC.FORM.CITY_TYPE') | translate"
                   (input)="set($any($event.target).value)" (blur)="onCityBlur($any($event.target))" />
            <datalist [id]="id + '-list'">
              @for (c of state.cities() ?? []; track c) { <option [value]="c"></option> }
            </datalist>
          }
        }

        @case ('item_variant') {
          <ng-container *ngTemplateOutlet="labelTpl" />
          <select [id]="id" class="form-select" [class.is-invalid]="!!error()" (change)="set($any($event.target).value || undefined)" (blur)="blur()">
            <option value="" [selected]="isEmptyValue()">{{ 'V2.PUBLIC.FORM.SELECT' | translate }}</option>
            @for (v of item()?.variants ?? []; track v.code) {
              <option [value]="v.code" [disabled]="v.soldOut" [selected]="v.code === val()">
                {{ v.label | i18n }}@if (v.priceCents !== item()!.priceCents) { · {{ money(v.priceCents) }} }@if (v.soldOut) { · {{ 'V2.PUBLIC.FORM.SOLD_OUT' | translate }} }
              </option>
            }
          </select>
        }
      }

      @if (error(); as e) {
        <div class="ff__error" role="alert">{{ ('V2.PUBLIC.ERR.' + e.code) | translate: e.params }}</div>
      }
      @if (field.help) { <div class="ff__help">{{ field.help | i18n }}</div> }
    </div>

    <!-- Etiqueta arriba del campo -->
    <ng-template #labelTpl>
      <label class="form-label" [for]="id">
        {{ field.label | i18n }}
        @if (!field.required && field.type !== 'item_variant') { <span class="text-muted small">({{ 'V2.PUBLIC.FORM.OPTIONAL' | translate }})</span> }
      </label>
    </ng-template>

    <!-- Casilla con la etiqueta al lado (aceptar, sí/no, productos) -->
    <ng-template #checkTpl>
      <label class="ff__option ff__option--check" [class.ff__option--on]="val() === true" [for]="id">
        <input [id]="id" type="checkbox" class="form-check-input" [checked]="val() === true" [class.is-invalid]="!!error()"
               (change)="set($any($event.target).checked); blur()" />
        <span class="ff__check-text">
          {{ field.label | i18n }}
          @if (field.type === 'item_toggle' && item(); as it) {
            @if (it.priceCents > 0) { <span class="ff__price">+ {{ money(it.priceCents) }}</span> }
            @if (it.description) { <small class="d-block text-muted">{{ it.description | i18n }}</small> }
          }
        </span>
      </label>
    </ng-template>
  `,
    styles: [`
    :host { display: block; }
    .ff__error { color: #dc3545; font-size: 13px; margin-top: 6px; }
    .ff__help { color: var(--text-muted); font-size: 13px; margin-top: 6px; }
    .ff__options { display: flex; flex-wrap: wrap; gap: 8px; }
    .ff__option {
      display: flex; align-items: center; gap: 10px; cursor: pointer;
      border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; background: #fff; margin: 0;
      transition: border-color .12s, background .12s;
    }
    .ff__option:hover { border-color: color-mix(in srgb, var(--brand-primary) 50%, #fff); }
    .ff__option--on { border-color: var(--brand-primary); background: color-mix(in srgb, var(--brand-primary) 7%, #fff); }
    .ff__option--check { width: 100%; align-items: flex-start; }
    .ff__option .form-check-input { margin: 2px 0 0; flex-shrink: 0; width: 1.15em; height: 1.15em; }
    .form-check-input:checked { background-color: var(--brand-primary); border-color: var(--brand-primary); }
    .ff__price { font-weight: 600; color: var(--brand-primary); margin-left: 6px; white-space: nowrap; }
    legend.form-label { font-size: 1rem; float: none; }
    fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
    .ff--invalid .ff__option { border-color: #f1aeb5; }
  `],
})
export class FormFieldComponent {
    @Input({ required: true }) field!: FormField;
    @Input({ required: true }) state!: FormState;

    private language = inject(LanguageService);
    readonly newChurch = NEW_CHURCH;
    readonly today = new Date().toLocaleDateString('en-CA');

    get id() { return `f-${this.field.key}`; }

    get autocomplete(): string | null {
        return ({ first_name: 'given-name', last_name: 'family-name', phone: 'tel' } as Record<string, string>)[this.field.maps_to ?? ''] ?? null;
    }

    val(): unknown { return this.state.values()[this.field.key]; }
    str(): string { const v = this.val(); return v === undefined || v === null ? '' : String(v); }
    isEmptyValue(): boolean { const v = this.val(); return v === undefined || v === null || v === ''; }
    error(): FieldError | null { return this.state.errorFor(this.field.key); }
    set(value: unknown) { this.state.set(this.field, value); }
    blur() { this.state.touch(this.field.key); }

    money(cents: number) {
        return formatMoney(cents, this.language.currentLang(), this.state.form.payments.currency.toUpperCase());
    }

    item(): PublicItem | undefined {
        return this.state.items().find(i => i.code === this.field.item);
    }

    // ── Opciones (radio / select / grupo) ─────────────────────────────

    isChosen(opt: FormOption): boolean {
        const v = this.val();
        return v !== undefined && (JSON.stringify(v) === JSON.stringify(opt.value) || String(v) === String(opt.value) && typeof v !== 'boolean');
    }

    onSelect(index: string) {
        this.set(index === '' ? undefined : this.field.options?.[Number(index)]?.value);
    }

    inGroup(opt: FormOption): boolean {
        return Array.isArray(this.val()) && (this.val() as unknown[]).some(v => JSON.stringify(v) === JSON.stringify(opt.value));
    }

    toggleGroup(opt: FormOption) {
        const current = Array.isArray(this.val()) ? [...(this.val() as unknown[])] : [];
        const index = current.findIndex(v => JSON.stringify(v) === JSON.stringify(opt.value));
        if (index >= 0) current.splice(index, 1); else current.push(opt.value);
        this.set(current);
    }

    // ── Estado y asociación ───────────────────────────────────────────

    location(): LocationValue {
        return (this.val() as LocationValue | undefined) ?? { state: '', conference_id: null };
    }

    conferences() {
        return this.state.locations().find(l => l.code === this.location().state)?.conferences ?? [];
    }

    onState(code: string) {
        const conferences = this.state.locations().find(l => l.code === code)?.conferences ?? [];
        // Si el estado tiene una sola asociación, se elige sola
        this.set({ state: code, conference_id: conferences.length === 1 ? conferences[0].id : null } satisfies LocationValue);
        this.blur();
    }

    onConference(id: string) {
        this.set({ state: this.location().state, conference_id: id ? Number(id) : null } satisfies LocationValue);
        this.blur();
    }

    // ── Ciudad ────────────────────────────────────────────────────────

    /** Al salir del campo: sin espacios de más y con la escritura de la lista ("phoenix" → "Phoenix"). */
    onCityBlur(input: HTMLInputElement) {
        const fixed = canonicalCity(this.state.cities() ?? [], input.value);
        if (fixed !== input.value) input.value = fixed;
        if (fixed !== this.str()) this.set(fixed);
        this.blur();
    }

    // ── Iglesia ───────────────────────────────────────────────────────

    church(): ChurchValue | undefined { return this.val() as ChurchValue | undefined; }
    notListed(): boolean { return this.church()?.new_name !== undefined; }
    churchList() { const list = this.state.churches(); return Array.isArray(list) ? list : []; }
    setChurch(value: ChurchValue | undefined) { this.set(value); }

    onChurch(value: string) {
        if (value === NEW_CHURCH) this.set({ new_name: '' } satisfies ChurchValue);
        else this.set(value ? { church_id: Number(value) } satisfies ChurchValue : undefined);
        this.blur();
    }
}
