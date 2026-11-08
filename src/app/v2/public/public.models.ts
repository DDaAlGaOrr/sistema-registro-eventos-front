import { I18nText } from '../core/models';

export type Availability = 'open' | 'not_open_yet' | 'closed' | 'full';

// ── Estructura del formulario (la que arma el constructor del Paso 12) ──

export type FieldType =
    | 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'date' | 'checkbox' | 'consent'
    | 'radio' | 'select' | 'checkbox_group'
    | 'state_conference_picker' | 'church_picker' | 'city_picker' | 'item_toggle' | 'item_variant';

export type OptionValue = string | number | boolean;

export interface FormOption {
    value: OptionValue;
    label: I18nText;
}

export interface Condition {
    field: string;
    equals?: OptionValue;
    not_equals?: OptionValue;
    in?: OptionValue[];
}

export interface FormField {
    key: string;
    type: FieldType;
    label: I18nText;
    help?: I18nText;
    required?: boolean;
    visible_when?: Condition;
    maps_to?: string;
    options?: FormOption[];
    min_length?: number;
    max_length?: number;
    min?: number | string;
    max?: number | string;
    integer?: boolean;
    min_selected?: number;
    max_selected?: number;
    allow_new?: boolean;
    /** Código del producto (item_toggle / item_variant). */
    item?: string;
}

export interface FormStep {
    key: string;
    title: I18nText;
    description?: I18nText;
    fields: FormField[];
}

export interface FormSchema {
    steps: FormStep[];
}

// ── Lo que devuelve la API pública ──────────────────────────────────────

export interface PublicEvent {
    id: number;
    slug: string;
    name: I18nText;
    description: I18nText | null;
    venue: string | null;
    startsAt: string;
    endsAt: string;
    timezone: string;
    coverImageUrl: string | null;
    status: 'published' | 'closed';
}

export interface PublicEventListItem extends PublicEvent {
    availability: Availability;
    openFormId: number | null;
}

export interface PublicFormRef {
    id: number;
    title: I18nText;
    opensAt: string | null;
    closesAt: string | null;
    availability: Availability;
}

export interface PublicEventPage {
    event: PublicEvent;
    forms: PublicFormRef[];
}

export interface PublicVariant {
    code: string;
    label: I18nText;
    priceCents: number;
    soldOut: boolean;
}

export interface PublicItem {
    code: string;
    kind: 'registration_fee' | 'product';
    name: I18nText;
    description: I18nText | null;
    priceCents: number;
    isRequired: boolean;
    variants: PublicVariant[];
}

export interface PublicForm {
    id: number;
    title: I18nText;
    event: PublicEvent;
    version: number;
    schema: FormSchema;
    items: PublicItem[];
    payments: { enabled: boolean; online: boolean; offline: boolean; currency: string };
    opensAt: string | null;
    closesAt: string | null;
    availability: Availability;
}

export interface PublicLocation {
    code: string;
    name: string;
    conferences: { id: number; name: string; shortName: string | null }[];
}

export interface ChurchOption {
    id: number;
    name: string;
    city: string | null;
}

export type PaymentMethod = 'online' | 'offline';

export interface RegistrationResult {
    publicCode: string;
    status: 'confirmed' | 'pending_payment';
    paymentStatus: 'not_required' | 'unpaid';
    paymentMethod: PaymentMethod | null;
    checkoutUrl: string | null;
    totalCents: number;
    currency: string;
    items: { code: string; name: I18nText; variantCode: string | null; unitPriceCents: number }[];
}

export interface PublicRegistration {
    publicCode: string;
    firstName: string;
    status: 'confirmed' | 'pending_payment' | 'cancelled';
    paymentStatus: 'not_required' | 'unpaid' | 'partially_paid' | 'paid' | 'refunded';
    totalCents: number;
    paidCents: number;
    currency: string;
    canPayOnline: boolean;
    checkedIn: boolean;
    locale: 'es' | 'en';
    createdAt: string;
    event: { name: I18nText; startsAt: string; endsAt: string; timezone: string; venue: string | null };
    confirmationMessage: I18nText | null;
    items: {
        code: string;
        name: I18nText;
        variant: { code: string; label: I18nText } | null;
        unitPriceCents: number;
        paymentStatus: string;
    }[];
}

/** Error de un campo devuelto por la API (400). */
export interface FieldErrorFromApi {
    field: string;
    code: string;
    message: string;
}
