export type Locale = 'es' | 'en';

export interface I18nText {
    es: string;
    en: string;
}

/** Respuesta estándar de la API: { status: 'ok', data }. */
export interface ApiEnvelope<T> {
    status: 'ok';
    data: T;
}

/** Error normalizado de la API para mostrar al usuario. */
export interface ApiError {
    status: number;
    message: string;
    details?: unknown;
}

export type Permission =
    | 'registrations.read' | 'registrations.update' | 'registrations.delete' | 'checkin.write'
    | 'payments.write' | 'events.manage' | 'forms.manage' | 'users.manage'
    | 'organizations.manage' | 'tenant.settings' | 'audit.read';

export type Role = 'owner' | 'finance' | 'staff' | 'viewer';

export interface TenantBranding {
    slug: string;
    name: string;
    defaultLocale: Locale;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
}

export interface SessionUser {
    id: number;
    name: string;
    email: string;
    isPlatformAdmin: boolean;
}

export interface Session {
    accessToken: string;
    user: SessionUser;
    tenant: { id: number; slug: string; name: string } | null;
    role: Role | null;
    scopeOrganizationId: number | null;
    permissions: Permission[];
}

export interface EventSummary {
    id: number;
    slug: string;
    name: I18nText;
    venue: string | null;
    startsAt: string;
    endsAt: string;
    timezone: string;
    status: 'draft' | 'published' | 'closed' | 'archived';
    organizer: { id: number; name: string; type: string; shortName: string | null };
}
