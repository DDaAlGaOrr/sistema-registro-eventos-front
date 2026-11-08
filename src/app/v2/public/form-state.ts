import { computed, signal } from '@angular/core';
import { ApiError } from '../core/models';
import {
    ChurchValue, ErrorCode, FieldError, LocationValue, Values, allFields, buildAnswers, computeLines,
    initialValues, totalOf, validateField, visibleKeys,
} from './form-engine';
import { PublicApiService } from './public-api.service';
import {
    ChurchOption, FieldErrorFromApi, FormField, FormStep, PublicForm, PublicItem, PublicLocation,
} from './public.models';

const API_CODES: ErrorCode[] = [
    'required', 'invalid_email', 'invalid_phone', 'invalid_number', 'not_integer', 'too_short', 'too_long',
    'out_of_range', 'invalid_date', 'future_date', 'invalid_option', 'must_accept', 'pick_min', 'pick_max', 'invalid',
];

/**
 * Estado de un registro en curso (una instancia por página de formulario):
 * respuestas, campos tocados, errores (locales y de la API), paso actual,
 * asociaciones/iglesias y total a pagar. Todo con señales: la pantalla se
 * actualiza sola cuando algo cambia.
 */
export class FormState {
    readonly values = signal<Values>({});
    readonly touched = signal<ReadonlySet<string>>(new Set());
    readonly serverErrors = signal<Record<string, FieldError>>({});
    readonly stepIndex = signal(0);

    /** Productos con sus existencias; se refrescan si algo se agota mientras llenan el formulario. */
    readonly items = signal<PublicItem[]>([]);
    readonly locations = signal<PublicLocation[]>([]);
    private readonly churchCache = signal<Record<number, ChurchOption[] | 'loading' | 'error'>>({});
    /** Ciudades sugeridas por código de estado ([] = escribirla a mano). */
    private readonly cityCache = signal<Record<string, string[] | 'loading'>>({});

    readonly visible = computed(() => visibleKeys(this.form.schema, this.values()));

    /** Pasos que tienen al menos un campo visible (un paso puede quedar vacío por las condiciones). */
    readonly steps = computed<FormStep[]>(() =>
        this.form.schema.steps.filter(step => step.fields.some(f => this.visible().has(f.key))));
    /** El último "paso" es el resumen: índice = steps().length. */
    readonly reviewIndex = computed(() => this.steps().length);
    readonly onReview = computed(() => this.stepIndex() === this.reviewIndex());
    readonly currentStep = computed(() => this.steps()[this.stepIndex()] ?? null);

    /** Errores de validación de todos los campos visibles. */
    readonly errors = computed(() => {
        const result: Record<string, FieldError> = {};
        const visible = this.visible();
        const values = this.values();
        for (const field of allFields(this.form.schema)) {
            if (!visible.has(field.key)) continue;
            const error = validateField(field, values[field.key], { items: this.items() });
            if (error) result[field.key] = error;
        }
        return result;
    });

    readonly lines = computed(() => computeLines(this.form.schema, this.items(), this.values(), this.visible()));
    readonly totalCents = computed(() => totalOf(this.lines()));

    /** Asociación elegida (para cargar sus iglesias). */
    readonly conferenceId = computed(() => {
        const field = allFields(this.form.schema).find(f => f.type === 'state_conference_picker');
        const value = field ? this.values()[field.key] as LocationValue | undefined : undefined;
        return value?.conference_id ?? null;
    });

    /** Estado elegido (para sugerir sus ciudades). */
    readonly stateCode = computed(() => {
        const field = allFields(this.form.schema).find(f => f.type === 'state_conference_picker');
        const value = field ? this.values()[field.key] as LocationValue | undefined : undefined;
        return value?.state || null;
    });

    /** Ciudades sugeridas del estado elegido; `null` mientras cargan o si no hay estado. */
    readonly cities = computed<string[] | null>(() => {
        const code = this.stateCode();
        const cached = code ? this.cityCache()[code] : undefined;
        return Array.isArray(cached) ? cached : null;
    });

    readonly churches = computed(() => {
        const id = this.conferenceId();
        return id ? this.churchCache()[id] ?? null : null;
    });

    constructor(readonly form: PublicForm, private api: PublicApiService) {
        this.values.set(initialValues(form.schema));
        this.items.set(form.items);
    }

    // ── Cambios ───────────────────────────────────────────────────────

    set(field: FormField, value: unknown) {
        const previousState = this.stateCode();
        this.values.update(v => ({ ...v, [field.key]: value }));
        this.serverErrors.update(e => {
            if (!(field.key in e)) return e;
            const { [field.key]: _removed, ...rest } = e;
            return rest;
        });

        if (field.type === 'state_conference_picker') {
            // Otro estado → otra lista de ciudades (cambiar solo de asociación conserva la ciudad)
            const newState = (value as LocationValue | undefined)?.state || null;
            if (newState !== previousState) {
                for (const city of allFields(this.form.schema).filter(f => f.type === 'city_picker')) {
                    this.values.update(v => ({ ...v, [city.key]: '' }));
                }
                if (newState) this.loadCities(newState);
            }
            // Otra asociación → otras iglesias
            for (const church of allFields(this.form.schema).filter(f => f.type === 'church_picker')) {
                this.values.update(v => ({ ...v, [church.key]: undefined }));
            }
            const conferenceId = (value as LocationValue | undefined)?.conference_id;
            if (conferenceId) this.loadChurches(conferenceId);
        }
    }

    touch(key: string) {
        if (!this.touched().has(key)) this.touched.update(t => new Set(t).add(key));
    }

    private touchStep(step: FormStep) {
        this.touched.update(t => {
            const next = new Set(t);
            step.fields.forEach(f => next.add(f.key));
            return next;
        });
    }

    loadChurches(conferenceId: number, force = false) {
        const current = this.churchCache()[conferenceId];
        if (!force && (Array.isArray(current) || current === 'loading')) return;
        this.churchCache.update(c => ({ ...c, [conferenceId]: 'loading' }));
        this.api.churches(conferenceId).subscribe({
            next: list => this.churchCache.update(c => ({ ...c, [conferenceId]: list })),
            error: () => this.churchCache.update(c => ({ ...c, [conferenceId]: 'error' })),
        });
    }

    loadCities(stateCode: string) {
        if (this.cityCache()[stateCode]) return;
        this.cityCache.update(c => ({ ...c, [stateCode]: 'loading' }));
        this.api.cities(stateCode).subscribe({
            next: res => this.cityCache.update(c => ({ ...c, [stateCode]: res.cities })),
            // Sin sugerencias el campo sigue funcionando: la ciudad se escribe a mano
            error: () => this.cityCache.update(c => ({ ...c, [stateCode]: [] })),
        });
    }

    /** Vuelve a pedir los productos (por ejemplo cuando se agotó una talla). */
    refreshItems() {
        this.api.form(this.form.id).subscribe({
            next: form => {
                this.items.set(form.items);
                // Si la talla elegida se agotó, se limpia para que elijan otra
                for (const field of allFields(this.form.schema).filter(f => f.type === 'item_variant')) {
                    const variant = form.items.find(i => i.code === field.item)?.variants.find(v => v.code === this.values()[field.key]);
                    if (variant?.soldOut) this.values.update(v => ({ ...v, [field.key]: undefined }));
                }
            },
            error: () => undefined,
        });
    }

    // ── Errores visibles ──────────────────────────────────────────────

    /** El error que se muestra en un campo: el de la API, o el local si ya lo tocó. */
    errorFor(key: string): FieldError | null {
        return this.serverErrors()[key] ?? (this.touched().has(key) ? this.errors()[key] ?? null : null);
    }

    stepHasErrors(step: FormStep): boolean {
        const errors = this.errors();
        return step.fields.some(f => this.visible().has(f.key) && errors[f.key]);
    }

    // ── Navegación ────────────────────────────────────────────────────

    /** Avanza si el paso actual está bien; si no, marca los errores y devuelve la primera clave con error. */
    next(): { ok: true } | { ok: false; firstInvalid: string } {
        const step = this.currentStep();
        if (step) {
            this.touchStep(step);
            const invalid = step.fields.find(f => this.visible().has(f.key) && this.errors()[f.key]);
            if (invalid) return { ok: false, firstInvalid: invalid.key };
        }
        this.stepIndex.update(i => Math.min(i + 1, this.reviewIndex()));
        return { ok: true };
    }

    back() {
        this.stepIndex.update(i => Math.max(i - 1, 0));
    }

    /** Primer paso con errores (para volver a él antes de enviar). */
    firstInvalidStep(): number {
        return this.steps().findIndex(step => this.stepHasErrors(step));
    }

    goTo(index: number) {
        this.stepIndex.set(Math.min(Math.max(index, 0), this.reviewIndex()));
    }

    // ── Envío ─────────────────────────────────────────────────────────

    answers() {
        return buildAnswers(this.form.schema, this.values(), this.visible());
    }

    /** Errores por campo que devuelve la API (400): se muestran en el campo y lleva al paso. */
    applyApiErrors(apiError: ApiError): { stepIndex: number; firstKey: string } | null {
        const list = ((apiError.details as { errors?: FieldErrorFromApi[] } | undefined)?.errors ?? []);
        if (!list.length) return null;
        const map: Record<string, FieldError> = {};
        for (const e of list) {
            const code = (API_CODES as string[]).includes(e.code) ? e.code as ErrorCode : e.code === 'not_allowed' ? 'invalid_option' : 'invalid';
            map[e.field] = { code };
        }
        this.serverErrors.set(map);
        const steps = this.steps();
        const stepIndex = steps.findIndex(s => s.fields.some(f => map[f.key]));
        const firstKey = Object.keys(map)[0];
        return { stepIndex: stepIndex >= 0 ? stepIndex : this.reviewIndex(), firstKey };
    }
}
