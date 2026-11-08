import { I18nText } from '../core/models';

export type RegistrationStatus = 'confirmed' | 'pending_payment' | 'cancelled';
export type PaymentStatus = 'not_required' | 'unpaid' | 'partially_paid' | 'paid' | 'refunded';
export type Gender = 'male' | 'female' | 'undisclosed';

export interface Page<T> {
    page: number;
    pageSize: number;
    total: number;
    items: T[];
}

// ── Resumen ─────────────────────────────────────────────────────────────

export interface EventReport {
    event: { id: number; name: I18nText; timezone: string };
    totals: { registrations: number; checkedIn: number; totalCents: number; paidCents: number; pendingCents: number };
    byStatus: Record<string, number>;
    byPaymentStatus: Record<string, number>;
    byGender: Record<string, number>;
    byConference: { id: number | null; name: string | null; shortName: string | null; registrations: number; checkedIn: number }[];
    byChurch: { id: number | null; name: string | null; status: string | null; registrations: number }[];
    daily: { date: string; count: number }[];
    items: {
        code: string;
        name: I18nText;
        variants: {
            variant: string | null; label: I18nText | null; total: number; paid: number; unpaid: number; notRequired: number;
            delivered: number; cents: number; paidCents: number;
        }[];
    }[];
    answers: {
        key: string;
        label: I18nText;
        counts: { value: string; label: I18nText | null; count: number }[];
        unanswered: number;
    }[];
    paymentsByMethod: { method: PaymentMethodKey; cents: number; payments: number }[];
}

export type PaymentMethodKey = 'card' | 'cash' | 'check' | 'zelle' | 'other' | string;

export interface ActivityItem {
    id: number;
    action: string;
    at: string;
    by: string | null;
    registration: { id: number; firstName: string; lastName: string; conferenceId: number | null };
}

// ── Registros ───────────────────────────────────────────────────────────

export interface RegistrationItemSummary {
    id: number;
    code: string;
    variantCode: string | null;
    unitPriceCents: number;
    paymentStatus: string;
    deliveredAt: string | null;
}

export interface RegistrationListItem {
    id: number;
    publicCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    conference: { id: number; shortName: string | null } | null;
    church: { id: number; name: string } | null;
    churchNameRaw: string | null;
    status: RegistrationStatus;
    paymentStatus: PaymentStatus;
    totalCents: number;
    paidCents: number;
    checkedInAt: string | null;
    createdAt: string;
    deletedAt: string | null;
    items: RegistrationItemSummary[];
}

export interface RegistrationFilters {
    q?: string;
    conferenceId?: number | null;
    status?: RegistrationStatus | '';
    paymentStatus?: PaymentStatus | '';
    checkedIn?: 'true' | 'false' | '';
    deleted?: 'only' | '';
    itemCode?: string;
    variantCode?: string;
}

export type RegistrationSort = 'created_at' | 'last_name' | 'checked_in_at';

export interface OrgRef { id: number; name: string; shortName: string | null; status: string }

export interface RegistrationPayment {
    id: number;
    method: PaymentMethodKey;
    status: string;
    amountCents: number;
    refundedCents: number;
    reference: string | null;
    notes: string | null;
    paidAt: string | null;
    recordedBy: string | null;
}

export interface RegistrationItemDetail {
    id: number;
    itemId: number;
    code: string;
    kind: 'registration_fee' | 'product';
    name: I18nText;
    variant: { code: string; label: I18nText } | null;
    unitPriceCents: number;
    paymentStatus: string;
    deliveredAt: string | null;
    deliveredBy: string | null;
}

export interface RegistrationDetail {
    id: number;
    publicCode: string;
    event: { id: number; name: I18nText; slug: string };
    formId: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    birthDate: string | null;
    gender: Gender | null;
    locale: 'es' | 'en';
    conference: OrgRef | null;
    church: OrgRef | null;
    churchNameRaw: string | null;
    answers: Record<string, unknown>;
    answerLabels: Record<string, I18nText>;
    /** Etiquetas de las opciones de cada pregunta (para mostrar "Vegano" y no "vegan"). */
    answerOptions: Record<string, { value: unknown; label: I18nText }[]>;
    status: RegistrationStatus;
    paymentStatus: PaymentStatus;
    totalCents: number;
    paidCents: number;
    items: RegistrationItemDetail[];
    payments: RegistrationPayment[];
    checkIn: { at: string; by: string | null; method: string | null } | null;
    source: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

export interface RegistrationUpdate {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string | null;
    birthDate?: string | null;
    gender?: Gender | null;
    conferenceOrganizationId?: number | null;
    churchOrganizationId?: number | null;
}

// ── Auditoría ───────────────────────────────────────────────────────────

export interface AuditEntry {
    id: number;
    action: string;
    entityType: string;
    entityId: string | null;
    eventId: number | null;
    actor: { type: string; userId: number | null; name: string | null };
    changes: unknown;
    metadata: unknown;
    createdAt: string;
}

// ── Árbol de organizaciones (filtros) ───────────────────────────────────

export interface OrgNode {
    id: number;
    parentId: number | null;
    type: 'union' | 'conference' | 'church' | string;
    name: string;
    shortName: string | null;
    status: string;
    city: string | null;
    state: string | null;
    children: OrgNode[];
}

// ── Productos del formulario (para cambiar tallas) ──────────────────────

export interface FormItemsView {
    id: number;
    items: {
        id: number;
        code: string;
        variants: { id: number; code: string; label: I18nText; isActive: boolean; stock: number | null }[];
    }[];
}

// ── Check-in ────────────────────────────────────────────────────────────

/** Lo que ve el staff al escanear: quién es, qué pidió, qué debe y si ya entró. */
export interface CheckinSummary {
    id: number;
    publicCode: string;
    firstName: string;
    lastName: string;
    conference: { id: number; name: string; shortName: string | null } | null;
    church: { id?: number; name: string } | null;
    status: RegistrationStatus;
    paymentStatus: PaymentStatus;
    pendingCents: number;
    items: {
        id: number;
        code: string;
        name: I18nText;
        variant: { code: string; label: I18nText } | null;
        paymentStatus: string;
        deliveredAt: string | null;
    }[];
    checkIn: { at: string; by: string | null; method: string | null } | null;
}

export interface CheckinResult {
    result: 'checked_in' | 'already_checked_in';
    registration: CheckinSummary;
}

// ── Pagos ───────────────────────────────────────────────────────────────

export type ManualMethod = 'cash' | 'check' | 'zelle' | 'other';

export interface EventPayment {
    id: number;
    method: PaymentMethodKey;
    status: string;
    amountCents: number;
    refundedCents: number;
    reference: string | null;
    notes: string | null;
    paidAt: string | null;
    createdAt: string;
    recordedBy: string | null;
    registration: { id: number; firstName: string; lastName: string; publicCode: string };
}

export interface EventPaymentsPage extends Page<EventPayment> {
    totals: { collectedCents: number; refundedCents: number; netCents: number };
}

export interface PaymentFilters {
    method?: PaymentMethodKey | '';
    status?: string;
}

export interface ManualPaymentInput {
    method: ManualMethod;
    /** Productos que cubre (registration_items.id); vacío = todo lo pendiente. */
    itemIds?: number[];
    reference?: string | null;
    notes?: string | null;
}

// ── Auditoría (filtros y miembros para elegir a la persona) ─────────────

export interface AuditFilters {
    eventId?: number | null;
    entityType?: string;
    action?: string;
    actorUserId?: number | null;
    from?: string;
    to?: string;
}

export interface Member {
    userId: number;
    name: string;
    email: string;
    role: string;
}
