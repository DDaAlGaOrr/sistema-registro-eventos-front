import { DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { LanguageService } from '../../core/services/language.service';
import { I18nPipe, formatEventDateTime, formatEventDates, formatMoney } from '../core/i18n';
import { ApiError } from '../core/models';
import { TenantService } from '../core/tenant.service';
import { ChurchValue, LocationValue } from './form-engine';
import { FormFieldComponent } from './form-field.component';
import { FormState } from './form-state';
import { PublicApiService } from './public-api.service';
import { FormField, FormStep, PaymentMethod, PublicForm } from './public.models';

/** Campos cortos van de a dos por fila en pantallas grandes. */
const HALF_WIDTH = new Set(['text', 'email', 'phone', 'number', 'date', 'select', 'item_variant']);

type PageStatus = 'loading' | 'ready' | 'closed' | 'notfound' | 'error';

@Component({
    selector: 'app-registration-page',
    standalone: true,
    imports: [FormFieldComponent, TranslateModule, I18nPipe, RouterLink, NgClass, DatePipe],
    templateUrl: './registration-page.component.html',
    styleUrls: ['./registration-page.component.scss'],
})
export class RegistrationPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private api = inject(PublicApiService);
    readonly language = inject(LanguageService);
    readonly tenant = inject(TenantService);

    readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
    readonly formId = Number(this.route.snapshot.paramMap.get('formId'));

    readonly status = signal<PageStatus>('loading');
    readonly form = signal<PublicForm | null>(null);
    readonly state = signal<FormState | null>(null);

    readonly submitting = signal(false);
    readonly submitError = signal<string | null>(null);
    readonly paymentMethod = signal<PaymentMethod | null>(null);
    readonly paymentError = signal(false);

    readonly totalSteps = computed(() => (this.state()?.steps().length ?? 0) + 1);
    readonly progress = computed(() => {
        const s = this.state();
        return s ? Math.round(((s.stepIndex() + 1) / this.totalSteps()) * 100) : 0;
    });

    /** ¿Hay algo que cobrar con estas respuestas? */
    readonly needsPayment = computed(() => {
        const s = this.state();
        return !!s && s.form.payments.enabled && s.totalCents() > 0;
    });

    readonly allowedMethods = computed<PaymentMethod[]>(() => {
        const p = this.form()?.payments;
        if (!p) return [];
        return [p.online && 'online', p.offline && 'offline'].filter(Boolean) as PaymentMethod[];
    });

    ngOnInit() {
        if (!this.formId) { this.status.set('notfound'); return; }
        forkJoin({ form: this.api.form(this.formId), locations: this.api.locations() }).subscribe({
            next: ({ form, locations }) => {
                // El formulario debe ser de este evento (la dirección lo dice)
                if (form.event.slug !== this.slug) { this.status.set('notfound'); return; }
                this.form.set(form);
                const state = new FormState(form, this.api);
                state.locations.set(locations);
                this.state.set(state);
                if (this.allowedMethods().length === 1) this.paymentMethod.set(this.allowedMethods()[0]);
                this.status.set(form.availability === 'open' ? 'ready' : 'closed');
            },
            error: (e: ApiError) => this.status.set(e.status === 404 ? 'notfound' : 'error'),
        });
    }

    // ── Presentación ──────────────────────────────────────────────────

    get lang() { return this.language.currentLang(); }

    colClass(field: FormField) {
        return HALF_WIDTH.has(field.type) ? 'col-12 col-md-6' : 'col-12';
    }

    visibleFields(step: FormStep): FormField[] {
        const visible = this.state()!.visible();
        return step.fields.filter(f => visible.has(f.key));
    }

    eventDates(form: PublicForm) { return formatEventDates(form.event, this.lang); }
    dateTime(iso: string, form: PublicForm) { return formatEventDateTime(iso, form.event.timezone, this.lang); }

    money(cents: number) {
        return formatMoney(cents, this.lang, (this.form()?.payments.currency ?? 'usd').toUpperCase());
    }

    /** Respuesta formateada para el resumen. */
    display(field: FormField, value: unknown): string {
        const state = this.state()!;
        const empty = '—';
        if (value === undefined || value === null || value === '') return empty;
        switch (field.type) {
            case 'checkbox':
            case 'consent':
                return this.lang === 'es' ? (value ? 'Sí' : 'No') : (value ? 'Yes' : 'No');
            case 'radio':
            case 'select': {
                const opt = field.options?.find(o => JSON.stringify(o.value) === JSON.stringify(value) || String(o.value) === String(value));
                return opt ? opt.label[this.lang] : String(value);
            }
            case 'checkbox_group': {
                const list = (value as unknown[]).map(v => field.options?.find(o => JSON.stringify(o.value) === JSON.stringify(v))?.label[this.lang] ?? String(v));
                return list.length ? list.join(', ') : empty;
            }
            case 'state_conference_picker': {
                const v = value as LocationValue;
                const location = state.locations().find(l => l.code === v.state);
                const conf = location?.conferences.find(c => c.id === v.conference_id);
                return conf && location ? `${conf.name} · ${location.name}` : empty;
            }
            case 'church_picker': {
                const v = value as ChurchValue;
                if (v.new_name) return v.new_name;
                const list = state.churches();
                return Array.isArray(list) ? list.find(c => c.id === v.church_id)?.name ?? empty : empty;
            }
            case 'date': {
                const date = new Date(`${String(value)}T00:00:00Z`);
                return Number.isNaN(date.getTime()) ? String(value)
                    : new Intl.DateTimeFormat(this.lang === 'es' ? 'es-MX' : 'en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
            }
            default:
                return String(value);
        }
    }

    /** Campos que se listan en el resumen (los productos van aparte, con su precio). */
    summaryFields(step: FormStep): FormField[] {
        return this.visibleFields(step).filter(f => f.type !== 'item_toggle' && f.type !== 'item_variant');
    }

    // ── Navegación ────────────────────────────────────────────────────

    next() {
        const state = this.state()!;
        this.submitError.set(null);
        const result = state.next();
        if (result.ok) this.scrollTop();
        else this.focusField(result.firstInvalid);
    }

    back() {
        this.state()!.back();
        this.submitError.set(null);
        this.scrollTop();
    }

    edit(index: number) {
        this.state()!.goTo(index);
        this.scrollTop();
    }

    private scrollTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    private focusField(key: string) {
        setTimeout(() => {
            const el = document.getElementById(`f-${key}`) ?? document.getElementById(`f-${key}-state`);
            el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            (el as HTMLElement | null)?.focus({ preventScroll: true });
        });
    }

    // ── Envío ─────────────────────────────────────────────────────────

    submit() {
        const state = this.state()!;
        if (this.submitting()) return;
        this.submitError.set(null);
        this.paymentError.set(false);

        const badStep = state.firstInvalidStep();
        if (badStep >= 0) {
            state.steps().forEach(step => step.fields.forEach(f => state.touch(f.key)));
            state.goTo(badStep);
            this.submitError.set('V2.PUBLIC.FORM.FIX_ERRORS');
            this.scrollTop();
            return;
        }
        if (this.needsPayment() && !this.paymentMethod()) {
            this.paymentError.set(true);
            return;
        }

        this.submitting.set(true);
        this.api.register(this.formId, {
            answers: state.answers(),
            locale: this.lang,
            paymentMethod: this.needsPayment() ? this.paymentMethod() ?? undefined : undefined,
        }).subscribe({
            next: result => {
                if (result.checkoutUrl) window.location.href = result.checkoutUrl;
                else this.router.navigate(['/registro/confirmacion', result.publicCode]);
            },
            error: (e: ApiError) => {
                this.submitting.set(false);
                this.handleError(e);
            },
        });
    }

    private handleError(e: ApiError) {
        const state = this.state()!;
        const details = (e.details ?? {}) as { reason?: string; publicCode?: string };

        // Registro guardado pero no se pudo abrir el pago: a la confirmación para reintentar
        if (details.reason === 'checkout_failed' && details.publicCode) {
            this.router.navigate(['/registro/confirmacion', details.publicCode], { queryParams: { pago: 'error' } });
            return;
        }
        if (e.status === 400) {
            const first = state.applyApiErrors(e);
            const paymentIssue = ((e.details as { errors?: { field: string }[] } | undefined)?.errors ?? []).some(x => x.field === 'paymentMethod');
            if (paymentIssue) this.paymentError.set(true);
            if (first) {
                state.goTo(first.stepIndex);
                this.submitError.set('V2.PUBLIC.FORM.FIX_ERRORS');
                this.scrollTop();
                return;
            }
        }
        if (details.reason === 'sold_out') state.refreshItems();
        if (details.reason === 'full' || details.reason === 'closed' || details.reason === 'not_open_yet') this.status.set('closed');
        const known = ['full', 'closed', 'not_open_yet', 'already_registered', 'sold_out', 'captcha'];
        this.submitError.set(details.reason && known.includes(details.reason)
            ? `V2.PUBLIC.SERVER.${details.reason}`
            : e.status === 0 || e.status === 429 ? `raw:${e.message}` : 'V2.PUBLIC.SERVER.generic');
        this.scrollTop();
    }
}
