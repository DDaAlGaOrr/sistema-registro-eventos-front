import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';
import { EventSummary, I18nText, Locale } from './models';

/** {es, en} → el texto del idioma actual: {{ event.name | i18n }} */
@Pipe({ name: 'i18n', standalone: true, pure: false })
export class I18nPipe implements PipeTransform {
    private language = inject(LanguageService);
    transform(value: I18nText | null | undefined): string {
        if (!value) return '';
        return value[this.language.currentLang()] ?? value.es;
    }
}

/** Fechas del evento en SU zona horaria (no la del navegador). */
export function formatEventDates(event: Pick<EventSummary, 'startsAt' | 'endsAt' | 'timezone'>, locale: Locale): string {
    const fmt = new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: event.timezone,
    });
    const start = fmt.format(new Date(event.startsAt));
    const end = fmt.format(new Date(event.endsAt));
    return start === end ? start : `${start} – ${end}`;
}

export const formatMoney = (cents: number, locale: Locale, currency = 'USD') =>
    new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency }).format(cents / 100);

/** Fecha y hora en la zona horaria del evento. */
export function formatEventDateTime(iso: string, timezone: string, locale: Locale): string {
    return new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
        dateStyle: 'long', timeStyle: 'short', timeZone: timezone,
    }).format(new Date(iso));
}
