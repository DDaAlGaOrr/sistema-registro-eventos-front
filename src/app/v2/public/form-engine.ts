/**
 * Motor del formulario dinámico: visibilidad, validación, respuestas y total.
 *
 * Son funciones puras que replican las reglas de la API (src/modules/forms/
 * answers.ts del backend) para dar respuesta inmediata al usuario. La API
 * vuelve a validar todo; si difiere, sus errores se muestran en el campo.
 */
import {
    Condition, FormField, FormSchema, FormStep, OptionValue, PublicItem, PublicVariant,
} from './public.models';

export type Values = Record<string, unknown>;

export type ErrorCode =
    | 'required' | 'invalid_email' | 'invalid_phone' | 'invalid_number' | 'not_integer' | 'too_short' | 'too_long'
    | 'out_of_range' | 'invalid_date' | 'future_date' | 'invalid_option' | 'must_accept' | 'pick_min' | 'pick_max' | 'invalid';

export interface FieldError {
    code: ErrorCode;
    params?: Record<string, number | string>;
}

/** Valor de los selectores de sistema. */
export interface LocationValue { state: string; conference_id: number | null }
export interface ChurchValue { church_id?: number; new_name?: string }

/** "  Los   Angeles " → "Los Angeles". */
export const cleanCity = (value: string) => value.replace(/\s+/g, ' ').trim();

const cityKey = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Si lo escrito coincide (sin importar mayúsculas ni acentos) con una sugerencia, usa la sugerencia. */
export function canonicalCity(suggestions: string[], typed: string): string {
    const cleaned = cleanCity(typed);
    const key = cityKey(cleaned);
    return suggestions.find(c => cityKey(c) === key) ?? cleaned;
}

export const allFields = (schema: FormSchema): FormField[] => schema.steps.flatMap(s => s.fields);

/** Valor inicial de un campo (los sí/no empiezan en "no", los grupos vacíos). */
export function initialValue(field: FormField): unknown {
    switch (field.type) {
        case 'checkbox':
        case 'consent':
        case 'item_toggle':
            return false;
        case 'checkbox_group':
            return [];
        default:
            return undefined;
    }
}

export function initialValues(schema: FormSchema): Values {
    const values: Values = {};
    for (const f of allFields(schema)) {
        const v = initialValue(f);
        if (v !== undefined) values[f.key] = v;
    }
    return values;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function conditionMet(c: Condition, values: Values, visible: Set<string>): boolean {
    // Si el campo del que depende está oculto, este también
    if (!visible.has(c.field)) return false;
    const current = values[c.field];
    const matches = (expected: OptionValue) => Array.isArray(current) ? current.some(v => same(v, expected)) : same(current, expected);
    if (c.in) return c.in.some(matches);
    if (c.equals !== undefined) return matches(c.equals);
    return !same(current, c.not_equals);
}

/** Claves de los campos visibles, en orden (una condición solo mira campos anteriores). */
export function visibleKeys(schema: FormSchema, values: Values): Set<string> {
    const visible = new Set<string>();
    for (const field of allFields(schema)) {
        if (!field.visible_when || conditionMet(field.visible_when, values, visible)) visible.add(field.key);
    }
    return visible;
}

// ── Validación ──────────────────────────────────────────────────────────

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

const todayLocal = () => new Date().toLocaleDateString('en-CA');

const isValidDate = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export interface ValidationContext {
    items: PublicItem[];
}

/** Variante elegida en un item_variant, si existe. */
export function variantOf(items: PublicItem[], itemCode: string, variantCode: unknown): PublicVariant | null {
    const item = items.find(i => i.code === itemCode);
    return item?.variants.find(v => v.code === variantCode) ?? null;
}

/** null = válido. Solo se llama para campos visibles. */
export function validateField(field: FormField, value: unknown, ctx: ValidationContext): FieldError | null {
    const required = !!field.required;

    // Sí/no
    if (field.type === 'checkbox' || field.type === 'consent') {
        return required && value !== true ? { code: 'must_accept' } : null;
    }
    if (field.type === 'item_toggle') return null;
    if (field.type === 'checkbox_group') {
        const list = Array.isArray(value) ? value : [];
        if (required && list.length === 0) return { code: 'required' };
        if (field.min_selected !== undefined && list.length > 0 && list.length < field.min_selected) {
            return { code: 'pick_min', params: { n: field.min_selected } };
        }
        if (field.max_selected !== undefined && list.length > field.max_selected) {
            return { code: 'pick_max', params: { n: field.max_selected } };
        }
        return null;
    }

    // Selectores de sistema (valor compuesto)
    if (field.type === 'state_conference_picker') {
        const v = value as LocationValue | undefined;
        if (!v?.state || !v.conference_id) return required || v?.state ? { code: 'required' } : null;
        return null;
    }
    if (field.type === 'church_picker') {
        const v = value as ChurchValue | undefined;
        if (v?.church_id) return null;
        const name = v?.new_name?.trim() ?? '';
        if (!name) return required ? { code: 'required' } : null;
        if (name.length < 2) return { code: 'too_short', params: { min: 2 } };
        if (name.length > 200) return { code: 'too_long', params: { max: 200 } };
        return null;
    }

    if (isEmpty(value)) return required ? { code: 'required' } : null;

    switch (field.type) {
        case 'text':
        case 'textarea': {
            const v = String(value).trim();
            const max = field.max_length ?? (field.type === 'text' ? 200 : 1000);
            if (v.length > max) return { code: 'too_long', params: { max } };
            if (field.type === 'text' && field.min_length !== undefined && v.length < field.min_length) {
                return { code: 'too_short', params: { min: field.min_length } };
            }
            return null;
        }
        case 'city_picker': {
            const v = cleanCity(String(value));
            return v.length > 120 ? { code: 'too_long', params: { max: 120 } } : null;
        }
        case 'email': {
            const v = String(value).trim();
            return v.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? { code: 'invalid_email' } : null;
        }
        case 'phone': {
            const v = String(value).trim();
            const digits = v.replace(/\D/g, '');
            return !/^[+\d\s().-]+$/.test(v) || digits.length < 7 || digits.length > 15 || v.length > 30
                ? { code: 'invalid_phone' } : null;
        }
        case 'number': {
            const n = typeof value === 'number' ? value : Number(String(value).trim());
            if (!Number.isFinite(n)) return { code: 'invalid_number' };
            if (field.integer && !Number.isInteger(n)) return { code: 'not_integer' };
            if ((field.min !== undefined && n < Number(field.min)) || (field.max !== undefined && n > Number(field.max))) {
                return { code: 'out_of_range', params: { min: field.min ?? '', max: field.max ?? '' } };
            }
            return null;
        }
        case 'date': {
            const v = String(value).trim().slice(0, 10);
            if (!isValidDate(v)) return { code: 'invalid_date' };
            if ((field.min && v < String(field.min)) || (field.max && v > String(field.max))) return { code: 'out_of_range' };
            if (field.maps_to === 'birth_date' && v > todayLocal()) return { code: 'future_date' };
            return null;
        }
        case 'radio':
        case 'select':
            return field.options?.some(o => same(o.value, value) || String(o.value) === String(value)) ? null : { code: 'invalid_option' };
        case 'item_variant': {
            const variant = variantOf(ctx.items, field.item ?? '', value);
            return !variant || variant.soldOut ? { code: 'invalid_option' } : null;
        }
    }
    return null;
}

export type StepErrors = Record<string, FieldError>;

/** Errores de los campos visibles de un paso. */
export function validateStep(step: FormStep, values: Values, visible: Set<string>, ctx: ValidationContext): StepErrors {
    const errors: StepErrors = {};
    for (const field of step.fields) {
        if (!visible.has(field.key)) continue;
        const error = validateField(field, values[field.key], ctx);
        if (error) errors[field.key] = error;
    }
    return errors;
}

// ── Respuestas y total ──────────────────────────────────────────────────

/** Cuerpo `answers` para la API: solo campos visibles y con valor. */
export function buildAnswers(schema: FormSchema, values: Values, visible: Set<string>): Record<string, unknown> {
    const answers: Record<string, unknown> = {};
    for (const field of allFields(schema)) {
        if (!visible.has(field.key)) continue;
        const raw = values[field.key];
        switch (field.type) {
            case 'checkbox':
            case 'consent':
            case 'item_toggle':
                answers[field.key] = raw === true;
                break;
            case 'checkbox_group':
                answers[field.key] = Array.isArray(raw) ? raw : [];
                break;
            case 'state_conference_picker': {
                const v = raw as LocationValue | undefined;
                if (v?.state && v.conference_id) answers[field.key] = { state: v.state, conference_id: v.conference_id };
                break;
            }
            case 'church_picker': {
                const v = raw as ChurchValue | undefined;
                if (v?.church_id) answers[field.key] = { church_id: v.church_id };
                else if (v?.new_name?.trim()) answers[field.key] = { new_name: v.new_name.trim() };
                break;
            }
            case 'number':
                if (!isEmpty(raw)) answers[field.key] = Number(raw);
                break;
            case 'city_picker':
                if (!isEmpty(raw)) answers[field.key] = cleanCity(String(raw));
                break;
            default:
                if (!isEmpty(raw)) answers[field.key] = typeof raw === 'string' ? raw.trim() : raw;
        }
    }
    return answers;
}

export interface TotalLine {
    item: PublicItem;
    variant: PublicVariant | null;
    priceCents: number;
}

/** Lo que se va a cobrar con las respuestas actuales (igual que la API). */
export function computeLines(schema: FormSchema, items: PublicItem[], values: Values, visible: Set<string>): TotalLine[] {
    const selected = new Map<string, string | null>();
    const fields = allFields(schema).filter(f => visible.has(f.key));
    for (const f of fields) {
        if (f.type === 'item_toggle' && f.item && values[f.key] === true) selected.set(f.item, selected.get(f.item) ?? null);
    }
    for (const f of fields) {
        if (f.type === 'item_variant' && f.item && !isEmpty(values[f.key])) selected.set(f.item, String(values[f.key]));
    }
    for (const item of items) {
        if (item.isRequired && !selected.has(item.code)) selected.set(item.code, null);
    }
    const lines: TotalLine[] = [];
    for (const [code, variantCode] of selected) {
        const item = items.find(i => i.code === code);
        if (!item) continue;
        const variant = variantCode ? item.variants.find(v => v.code === variantCode) ?? null : null;
        lines.push({ item, variant, priceCents: variant?.priceCents ?? item.priceCents });
    }
    return lines;
}

export const totalOf = (lines: TotalLine[]) => lines.reduce((sum, l) => sum + l.priceCents, 0);
