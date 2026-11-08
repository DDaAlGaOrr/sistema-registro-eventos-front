import { PaymentStatus, RegistrationStatus } from './admin.models';

/** Clase de Bootstrap para la insignia de cada estado de pago. */
export const PAYMENT_BADGE: Record<PaymentStatus, string> = {
    paid: 'text-bg-success',
    partially_paid: 'text-bg-warning',
    unpaid: 'text-bg-danger',
    not_required: 'text-bg-secondary',
    refunded: 'text-bg-info',
};

export const STATUS_BADGE: Record<RegistrationStatus, string> = {
    confirmed: 'text-bg-success',
    pending_payment: 'text-bg-warning',
    cancelled: 'text-bg-secondary',
};

/** Color de marca del cliente (lo define TenantService en :root). */
export function brandColor(): string {
    try {
        return getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim() || '#4f46e5';
    } catch {
        return '#4f46e5';
    }
}

export const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** Suma un día a una fecha YYYY-MM-DD (en UTC, sin depender de la zona del navegador). */
const nextDay = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
};

/** Rellena con 0 los días sin registros para que la gráfica no una puntos lejanos. */
export function fillDailyGaps(daily: { date: string; count: number }[]): { date: string; count: number }[] {
    if (daily.length < 2) return daily;
    const counts = new Map(daily.map(d => [d.date, d.count]));
    const out: { date: string; count: number }[] = [];
    const last = daily[daily.length - 1].date;
    for (let day = daily[0].date; day <= last; day = nextDay(day)) out.push({ date: day, count: counts.get(day) ?? 0 });
    return out;
}

/** Texto de la persona para las listas: "Apellidos, Nombre". */
export const fullName = (r: { firstName: string; lastName: string }) => `${r.lastName}, ${r.firstName}`;

/** Respuesta del formulario como texto para mostrar; `labelOf` traduce el valor de una opción a su etiqueta. */
export function formatAnswer(value: unknown, yes: string, no: string, labelOf?: (v: unknown) => string | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? yes : no;
    if (Array.isArray(value)) return value.length ? value.map(v => formatAnswer(v, yes, no, labelOf)).join(', ') : '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return labelOf?.(value) ?? String(value);
}
