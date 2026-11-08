import { computed, signal } from '@angular/core';
import { FieldType, FormField, FormSchema, FormStep } from '../../public/public.models';
import {
    SINGLE_TYPES, fieldKeys, localIssues, moveInArray, newField, newStep, sanitizeSchema, slugKey, stepKeys,
} from './schema-utils';

export interface Selection {
    step: number;
    /** null = el paso mismo. */
    field: number | null;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Estado del editor: el esquema que se está armando, qué está seleccionado y si hay
 * cambios sin guardar. Todo con señales; cada cambio genera un esquema nuevo.
 */
export class BuilderState {
    readonly schema = signal<FormSchema>({ steps: [] });
    readonly selection = signal<Selection | null>(null);
    private readonly savedJson = signal('');

    /** Hay cambios que todavía no están en el borrador guardado. */
    readonly dirty = computed(() => JSON.stringify(sanitizeSchema(this.schema())) !== this.savedJson());
    readonly issues = computed(() => localIssues(this.schema()));
    readonly selectedStep = computed(() => {
        const sel = this.selection();
        return sel ? this.schema().steps[sel.step] ?? null : null;
    });
    readonly selectedField = computed(() => {
        const sel = this.selection();
        return sel && sel.field !== null ? this.schema().steps[sel.step]?.fields[sel.field] ?? null : null;
    });
    readonly fieldCount = computed(() => this.schema().steps.reduce((n, s) => n + s.fields.length, 0));

    constructor(initial: FormSchema) {
        this.load(initial);
    }

    /** Carga un esquema como "lo guardado" (al abrir el editor o después de guardar). */
    load(schema: FormSchema) {
        const copy = clone(schema);
        this.schema.set(copy);
        this.savedJson.set(JSON.stringify(sanitizeSchema(copy)));
        const first = copy.steps[0];
        this.selection.set(first ? { step: 0, field: null } : null);
    }

    markSaved() {
        this.savedJson.set(JSON.stringify(sanitizeSchema(this.schema())));
    }

    /** Reemplaza el esquema (por ejemplo al empezar con los datos básicos); cuenta como cambio. */
    replace(schema: FormSchema) {
        this.schema.set(clone(schema));
        this.selection.set(schema.steps.length ? { step: 0, field: null } : null);
    }

    select(step: number, field: number | null) {
        this.selection.set({ step, field });
    }

    private update(change: (draft: FormSchema) => void) {
        const draft = clone(this.schema());
        change(draft);
        this.schema.set(draft);
    }

    // ── Pasos ─────────────────────────────────────────────────────────

    addStep() {
        this.update(d => { d.steps.push(newStep(stepKeys(d))); });
        this.select(this.schema().steps.length - 1, null);
    }

    updateStep(index: number, patch: Partial<Pick<FormStep, 'title' | 'description'>>) {
        this.update(d => { Object.assign(d.steps[index], patch); });
    }

    removeStep(index: number) {
        this.update(d => {
            const removed = d.steps.splice(index, 1)[0];
            for (const field of removed?.fields ?? []) this.dropConditionsOn(d, field.key);
        });
        const count = this.schema().steps.length;
        this.selection.set(count ? { step: Math.min(index, count - 1), field: null } : null);
    }

    moveStep(index: number, to: number) {
        this.update(d => { d.steps = moveInArray(d.steps, index, to); });
        this.select(Math.min(Math.max(to, 0), this.schema().steps.length - 1), null);
    }

    // ── Campos ────────────────────────────────────────────────────────

    /** Un campo de sistema que solo puede haber una vez ya está en el formulario. */
    isTypeUsed(type: FieldType): boolean {
        return SINGLE_TYPES.includes(type) && this.schema().steps.some(s => s.fields.some(f => f.type === type));
    }

    addField(stepIndex: number, type: FieldType) {
        let at = 0;
        this.update(d => {
            const step = d.steps[stepIndex];
            if (!step) return;
            step.fields.push(newField(type, fieldKeys(d)));
            at = step.fields.length - 1;
        });
        this.select(stepIndex, at);
    }

    updateField(stepIndex: number, fieldIndex: number, patch: Partial<FormField> | ((f: FormField) => FormField)) {
        this.update(d => {
            const field = d.steps[stepIndex]?.fields[fieldIndex];
            if (!field) return;
            d.steps[stepIndex].fields[fieldIndex] = typeof patch === 'function' ? patch(field) : { ...field, ...patch };
        });
    }

    /** Cambia la clave de un campo y actualiza las condiciones que lo usaban. Devuelve false si ya existe. */
    renameField(stepIndex: number, fieldIndex: number, newKey: string): boolean {
        const field = this.schema().steps[stepIndex]?.fields[fieldIndex];
        if (!field || newKey === field.key) return true;
        if (!/^[a-z][a-z0-9_]{0,49}$/.test(newKey) || fieldKeys(this.schema()).has(newKey)) return false;
        const old = field.key;
        this.update(d => {
            d.steps[stepIndex].fields[fieldIndex].key = newKey;
            for (const step of d.steps) for (const f of step.fields) if (f.visible_when?.field === old) f.visible_when.field = newKey;
        });
        return true;
    }

    /** Clave libre a partir de un texto (para sugerir la clave de un campo nuevo). */
    suggestKey(text: string): string {
        return slugKey(text, fieldKeys(this.schema()));
    }

    removeField(stepIndex: number, fieldIndex: number) {
        this.update(d => {
            const [removed] = d.steps[stepIndex].fields.splice(fieldIndex, 1);
            if (removed) this.dropConditionsOn(d, removed.key);
        });
        const left = this.schema().steps[stepIndex]?.fields.length ?? 0;
        this.selection.set({ step: stepIndex, field: left ? Math.min(fieldIndex, left - 1) : null });
    }

    /** Mueve un campo dentro de su paso o a otro paso (arrastrar y soltar o botones). */
    moveField(fromStep: number, fromIndex: number, toStep: number, toIndex: number) {
        this.update(d => {
            const [field] = d.steps[fromStep].fields.splice(fromIndex, 1);
            if (!field) return;
            const target = d.steps[toStep].fields;
            target.splice(Math.min(Math.max(toIndex, 0), target.length), 0, field);
        });
        const landed = Math.min(Math.max(toIndex, 0), this.schema().steps[toStep].fields.length - 1);
        this.select(toStep, landed);
    }

    /** Si se borra un campo, las condiciones que dependían de él se quitan (el campo queda siempre visible). */
    private dropConditionsOn(draft: FormSchema, key: string) {
        for (const step of draft.steps) for (const f of step.fields) if (f.visible_when?.field === key) delete f.visible_when;
    }
}
