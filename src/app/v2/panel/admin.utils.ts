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

/** Código público de 26 caracteres (Crockford) dentro de lo que lea el QR: el código solo o un enlace que lo contenga. */
export function extractPublicCode(text: string): string | null {
    const match = text.toUpperCase().match(/(?<![0-9A-Z])[0-9A-HJKMNP-TV-Z]{26}(?![0-9A-Z])/);
    return match ? match[0] : null;
}

/** Celda de CSV: comillas si hace falta y sin que Excel ejecute fórmulas (=, +, -, @). */
export function csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV con BOM para que Excel abra bien los acentos. */
export const toCsv = (rows: unknown[][]) => `﻿${rows.map(r => r.map(csvCell).join(',')).join('\r\n')}\r\n`;

/** Guarda un archivo en el equipo del usuario. */
export function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/** Piezas de una variante que ya se pueden entregar (pagadas o sin costo) y todavía no se entregan. */
export const toDeliver = (v: { paid: number; notRequired: number; delivered: number }) =>
    Math.max(0, v.paid + v.notRequired - v.delivered);

/** Vibración y sonido corto en el celular al leer un código (ok, aviso o error). Si el dispositivo no lo permite, no pasa nada. */
export function feedback(kind: 'ok' | 'warn' | 'error') {
    try { navigator.vibrate?.(kind === 'ok' ? 60 : [90, 60, 90]); } catch { /* sin vibración */ }
    try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = kind === 'ok' ? 880 : kind === 'warn' ? 520 : 260;
        gain.gain.value = 0.08;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
        osc.onended = () => void ctx.close();
    } catch { /* sin audio */ }
}
