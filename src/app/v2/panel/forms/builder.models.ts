import { I18nText } from '../../core/models';
import { FormSchema } from '../../public/public.models';

export type FormStatus = 'draft' | 'open' | 'closed';

/** Fila de la lista de formularios de un evento. */
export interface FormListItem {
    id: number;
    title: I18nText;
    status: FormStatus;
    opensAt: string | null;
    closesAt: string | null;
    paymentsEnabled: boolean;
    publishedVersion: number | null;
    registrations: number;
}

export interface AdminVariant {
    id: number;
    code: string;
    label: I18nText;
    priceCentsOverride: number | null;
    stock: number | null;
    sortOrder: number;
    isActive: boolean;
}

export interface AdminItem {
    id: number;
    code: string;
    kind: 'registration_fee' | 'product';
    name: I18nText;
    description: I18nText | null;
    priceCents: number;
    isRequired: boolean;
    maxPerRegistration: number | null;
    sortOrder: number;
    isActive: boolean;
    variants: AdminVariant[];
}

/** Formulario completo tal como lo devuelve GET /forms/:id. */
export interface AdminForm {
    id: number;
    eventId: number;
    title: I18nText;
    status: FormStatus;
    opensAt: string | null;
    closesAt: string | null;
    maxRegistrations: number | null;
    payments: { enabled: boolean; online: boolean; offline: boolean; currency: string };
    settings: { confirmationMessage?: I18nText };
    items: AdminItem[];
    publishedVersion: { id: number; version: number; publishedAt: string | null; schema: FormSchema } | null;
    draftVersion: { id: number; version: number; schema: FormSchema } | null;
}

export interface FormVersionInfo {
    id: number;
    version: number;
    status: 'draft' | 'published' | 'superseded';
    publishedAt: string | null;
    registrations: number;
}

/** Problema que reporta la API al guardar o publicar (path como steps[0].fields[2].options). */
export interface SchemaIssue {
    path: string;
    message: string;
}

export interface SaveDraftResult {
    versionId: number;
    version: number;
    /** Lo que falta para poder publicar (el borrador se guarda aunque esté incompleto). */
    publishIssues: SchemaIssue[];
}
