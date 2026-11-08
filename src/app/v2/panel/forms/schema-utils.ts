/**
 * Utilidades puras del constructor de formularios: tipos de campo, valores
 * iniciales, limpieza del esquema antes de guardarlo y revisión de lo que falta.
 * Reflejan las reglas de la API (src/modules/forms/form-schema.ts del backend),
 * que vuelve a validar todo al guardar y al publicar.
 */
import { I18nText } from '../../core/models';
import { Condition, FieldType, FormField, FormOption, FormSchema, FormStep, OptionValue } from '../../public/public.models';

export interface FieldTypeInfo {
    type: FieldType;
    icon: string;
    group: 'basic' | 'choice' | 'system';
}

export const FIELD_TYPES: FieldTypeInfo[] = [
    { type: 'text', icon: 'bi-fonts', group: 'basic' },
    { type: 'textarea', icon: 'bi-text-paragraph', group: 'basic' },
    { type: 'email', icon: 'bi-envelope', group: 'basic' },
    { type: 'phone', icon: 'bi-telephone', group: 'basic' },
    { type: 'number', icon: 'bi-123', group: 'basic' },
    { type: 'date', icon: 'bi-calendar-date', group: 'basic' },
    { type: 'checkbox', icon: 'bi-check-square', group: 'basic' },
    { type: 'consent', icon: 'bi-patch-check', group: 'basic' },
    { type: 'radio', icon: 'bi-ui-radios', group: 'choice' },
    { type: 'select', icon: 'bi-menu-button-wide', group: 'choice' },
    { type: 'checkbox_group', icon: 'bi-ui-checks', group: 'choice' },
    { type: 'state_conference_picker', icon: 'bi-geo-alt', group: 'system' },
    { type: 'church_picker', icon: 'bi-building', group: 'system' },
    { type: 'city_picker', icon: 'bi-pin-map', group: 'system' },
    { type: 'item_toggle', icon: 'bi-bag-plus', group: 'system' },
    { type: 'item_variant', icon: 'bi-rulers', group: 'system' },
];

/** Campos de sistema que solo pueden aparecer una vez en el formulario. */
export const SINGLE_TYPES: FieldType[] = ['state_conference_picker', 'church_picker', 'city_picker'];

/** Datos de la persona que un campo puede llenar (maps_to), según su tipo. */
export const MAPS_TO: Partial<Record<FieldType, string[]>> = {
    text: ['first_name', 'last_name', 'phone'],
    email: ['email'],
    phone: ['phone'],
    date: ['birth_date'],
    radio: ['gender'],
    select: ['gender'],
};

export const CORE_REQUIRED = ['first_name', 'last_name', 'email'] as const;

export const GENDER_OPTIONS: FormOption[] = [
    { value: 'male', label: { es: 'Hombre', en: 'Male' } },
    { value: 'female', label: { es: 'Mujer', en: 'Female' } },
    { value: 'undisclosed', label: { es: 'Prefiero no decir', en: 'Prefer not to say' } },
];

export const hasOptions = (type: FieldType) => type === 'radio' || type === 'select' || type === 'checkbox_group';

/** Propiedades que acepta cada tipo (la API rechaza las demás). */
const EXTRA_KEYS: Record<FieldType, string[]> = {
    text: ['maps_to', 'min_length', 'max_length'],
    textarea: ['max_length'],
    email: ['maps_to'],
    phone: ['maps_to'],
    number: ['min', 'max', 'integer'],
    date: ['maps_to', 'min', 'max'],
    checkbox: [],
    consent: [],
    radio: ['maps_to', 'options'],
    select: ['maps_to', 'options'],
    checkbox_group: ['options', 'min_selected', 'max_selected'],
    state_conference_picker: [],
    church_picker: ['allow_new'],
    city_picker: [],
    item_toggle: ['item'],
    item_variant: ['item'],
};

const clean = (t: I18nText | undefined): I18nText => ({ es: (t?.es ?? '').trim(), en: (t?.en ?? '').trim() });
const filled = (t: I18nText | undefined) => !!t && !!t.es.trim() && !!t.en.trim();
const present = (v: unknown) => v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && Number.isNaN(v));

export function sanitizeCondition(c: Condition | undefined): Condition | undefined {
    if (!c || !c.field) return undefined;
    if (c.in !== undefined) return c.in.length ? { field: c.field, in: c.in } : undefined;
    if (c.equals !== undefined) return { field: c.field, equals: c.equals };
    if (c.not_equals !== undefined) return { field: c.field, not_equals: c.not_equals };
    return undefined;
}

/** Deja un campo con solo lo que su tipo acepta y sin valores vacíos. */
export function sanitizeField(field: FormField): FormField {
    const out: Record<string, unknown> = {
        key: field.key, type: field.type, label: clean(field.label), required: !!field.required,
    };
    // La ayuda se manda solo si está en los dos idiomas
    if (field.help && filled(field.help)) out['help'] = clean(field.help);
    const condition = sanitizeCondition(field.visible_when);
    if (condition) out['visible_when'] = condition;

    const source = field as unknown as Record<string, unknown>;
    for (const key of EXTRA_KEYS[field.type]) {
        const value = source[key];
        if (key === 'options') {
            out['options'] = ((value as FormOption[] | undefined) ?? []).map(o => ({
                value: typeof o.value === 'string' ? o.value.trim() : o.value, label: clean(o.label),
            }));
        } else if (key === 'integer' || key === 'allow_new') {
            if (typeof value === 'boolean') out[key] = value;
        } else if (present(value)) {
            out[key] = typeof value === 'string' ? value.trim() : value;
        }
    }
    return out as unknown as FormField;
}

export function sanitizeSchema(schema: FormSchema): FormSchema {
    return {
        steps: schema.steps.map(step => ({
            key: step.key,
            title: clean(step.title),
            ...(step.description && filled(step.description) ? { description: clean(step.description) } : {}),
            fields: step.fields.map(sanitizeField),
        })),
    };
}

// ── Claves ──────────────────────────────────────────────────────────────

/** "Talla de playera" → "talla_de_playera"; única entre las claves ya usadas. */
export function slugKey(text: string, taken: ReadonlySet<string>, fallback = 'campo'): string {
    let base = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!base) base = fallback;
    if (!/^[a-z]/.test(base)) base = `${fallback}_${base}`;
    base = base.slice(0, 44);
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;
    return key;
}

export const fieldKeys = (schema: FormSchema) => new Set(schema.steps.flatMap(s => s.fields.map(f => f.key)));
export const stepKeys = (schema: FormSchema) => new Set(schema.steps.map(s => s.key));

// ── Valores iniciales ───────────────────────────────────────────────────

const DEFAULT_LABEL: Record<FieldType, I18nText> = {
    text: { es: 'Texto corto', en: 'Short text' },
    textarea: { es: 'Texto largo', en: 'Long text' },
    email: { es: 'Correo', en: 'Email' },
    phone: { es: 'Teléfono', en: 'Phone' },
    number: { es: 'Número', en: 'Number' },
    date: { es: 'Fecha', en: 'Date' },
    checkbox: { es: 'Casilla', en: 'Checkbox' },
    consent: { es: 'Acepto las reglas del evento', en: 'I accept the event rules' },
    radio: { es: 'Elige una opción', en: 'Choose one' },
    select: { es: 'Lista desplegable', en: 'Dropdown' },
    checkbox_group: { es: 'Elige las que apliquen', en: 'Choose all that apply' },
    state_conference_picker: { es: 'Estado y asociación', en: 'State and conference' },
    church_picker: { es: 'Iglesia', en: 'Church' },
    city_picker: { es: 'Ciudad', en: 'City' },
    item_toggle: { es: 'Quiero este producto', en: 'I want this product' },
    item_variant: { es: 'Talla', en: 'Size' },
};

export const defaultLabel = (type: FieldType): I18nText => ({ ...DEFAULT_LABEL[type] });

export function newField(type: FieldType, taken: ReadonlySet<string>): FormField {
    const label = defaultLabel(type);
    const field: FormField = { key: slugKey(label.es, taken), type, label, required: false };
    if (hasOptions(type)) {
        field.options = [
            { value: 'opcion_1', label: { es: 'Opción 1', en: 'Option 1' } },
            { value: 'opcion_2', label: { es: 'Opción 2', en: 'Option 2' } },
        ];
    }
    if (type === 'church_picker') field.allow_new = true;
    if (type === 'item_toggle' || type === 'item_variant') field.item = '';
    return field;
}

export function newStep(taken: ReadonlySet<string>): FormStep {
    return { key: slugKey('paso', taken, 'paso'), title: { es: 'Nuevo paso', en: 'New step' }, fields: [] };
}

/** Datos básicos con los que se empieza un formulario vacío (nombre, apellidos y correo son obligatorios para publicar). */
export function starterSchema(): FormSchema {
    return {
        steps: [{
            key: 'datos_personales',
            title: { es: 'Datos personales', en: 'Personal information' },
            fields: [
                { key: 'first_name', type: 'text', label: { es: 'Nombre', en: 'First name' }, required: true, maps_to: 'first_name' },
                { key: 'last_name', type: 'text', label: { es: 'Apellidos', en: 'Last name' }, required: true, maps_to: 'last_name' },
                { key: 'email', type: 'email', label: { es: 'Correo', en: 'Email' }, required: true, maps_to: 'email' },
                { key: 'phone', type: 'phone', label: { es: 'Teléfono', en: 'Phone' }, required: false, maps_to: 'phone' },
            ],
        }],
    };
}

// ── Orden y referencias ─────────────────────────────────────────────────

export function moveInArray<T>(list: readonly T[], from: number, to: number): T[] {
    const copy = [...list];
    if (from < 0 || from >= copy.length) return copy;
    const target = Math.min(Math.max(to, 0), copy.length - 1);
    const [item] = copy.splice(from, 1);
    copy.splice(target, 0, item);
    return copy;
}

/** Campos que están antes de uno dado (los únicos de los que puede depender su condición). */
export function fieldsBefore(schema: FormSchema, stepIndex: number, fieldIndex: number): FormField[] {
    const before: FormField[] = [];
    schema.steps.forEach((step, si) => {
        step.fields.forEach((field, fi) => {
            if (si < stepIndex || (si === stepIndex && fi < fieldIndex)) before.push(field);
        });
    });
    return before;
}

/** Valores posibles de un campo para armar una condición (null = texto libre). */
export function conditionChoices(field: FormField): { value: OptionValue; label: I18nText }[] | null {
    if (field.options?.length) return field.options.map(o => ({ value: o.value, label: o.label }));
    if (field.type === 'checkbox' || field.type === 'consent' || field.type === 'item_toggle') {
        return [{ value: true, label: { es: 'Sí', en: 'Yes' } }, { value: false, label: { es: 'No', en: 'No' } }];
    }
    return null;
}

/** Ubica un problema de la API: "steps[0].fields[2].label" o "steps.0.fields.2.label". */
export function locatePath(path: string): { stepIndex: number | null; fieldIndex: number | null } {
    const normalized = path.replace(/\.(\d+)/g, '[$1]');
    const match = normalized.match(/^steps\[(\d+)\](?:\.fields\[(\d+)\])?/);
    if (!match) return { stepIndex: null, fieldIndex: null };
    return { stepIndex: Number(match[1]), fieldIndex: match[2] !== undefined ? Number(match[2]) : null };
}

// ── Revisión local (traducciones y datos que la API rechaza con un mensaje poco claro) ──

export type LocalIssueCode =
    | 'step_title' | 'label' | 'help' | 'option_label' | 'option_value' | 'option_repeated' | 'item_missing' | 'options_missing'
    | 'condition_incomplete';

export interface LocalIssue {
    code: LocalIssueCode;
    stepIndex: number;
    fieldIndex: number | null;
}

export function localIssues(schema: FormSchema): LocalIssue[] {
    const issues: LocalIssue[] = [];
    schema.steps.forEach((step, si) => {
        if (!filled(step.title)) issues.push({ code: 'step_title', stepIndex: si, fieldIndex: null });
        step.fields.forEach((field, fi) => {
            const add = (code: LocalIssueCode) => issues.push({ code, stepIndex: si, fieldIndex: fi });
            if (!filled(field.label)) add('label');
            const help = field.help;
            if (help && (help.es.trim() || help.en.trim()) && !filled(help)) add('help');
            if (hasOptions(field.type)) {
                const options = field.options ?? [];
                if (!options.length) add('options_missing');
                if (options.some(o => !filled(o.label))) add('option_label');
                if (options.some(o => typeof o.value === 'string' && !o.value.trim())) add('option_value');
                const values = options.map(o => JSON.stringify(o.value));
                if (new Set(values).size !== values.length) add('option_repeated');
            }
            if ((field.type === 'item_toggle' || field.type === 'item_variant') && !field.item) add('item_missing');
            if (field.visible_when && !sanitizeCondition(field.visible_when)) add('condition_incomplete');
        });
    });
    return issues;
}
