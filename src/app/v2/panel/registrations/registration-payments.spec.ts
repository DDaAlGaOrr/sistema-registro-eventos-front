import { startOfDayIso } from '../audit/audit-page.component';
import { parseDollars } from './registration-payments.component';

describe('pagos y auditoría: utilidades', () => {
    it('parseDollars convierte a centavos y rechaza lo inválido', () => {
        expect(parseDollars('12.50')).toBe(1250);
        expect(parseDollars('$1,200')).toBe(120000);
        expect(parseDollars(' 4 ')).toBe(400);
        expect(parseDollars('0.1')).toBe(10);
        expect(parseDollars('19.99')).toBe(1999);
        expect(parseDollars('')).toBeNull();
        expect(parseDollars('abc')).toBeNull();
        expect(parseDollars('1.234')).toBeNull();
        expect(parseDollars('-5')).toBeNull();
    });

    it('startOfDayIso devuelve el inicio del día (y del siguiente con addDays)', () => {
        const start = new Date(startOfDayIso('2027-03-12'));
        expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2027, 2, 12, 0]);
        const next = new Date(startOfDayIso('2027-03-12', 1));
        expect(next.getTime() - start.getTime()).toBeGreaterThanOrEqual(23 * 3_600_000); // 23–25 h según cambio de horario
        expect(next.getDate()).toBe(13);
    });
});
