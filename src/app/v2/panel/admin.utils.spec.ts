import { registrationQuery, conferencesOf } from './admin-api.service';
import { OrgNode } from './admin.models';
import { fillDailyGaps, formatAnswer, percent } from './admin.utils';

describe('admin utils', () => {
    it('fillDailyGaps rellena los días sin registros con 0', () => {
        expect(fillDailyGaps([{ date: '2027-02-27', count: 2 }, { date: '2027-03-02', count: 5 }])).toEqual([
            { date: '2027-02-27', count: 2 }, { date: '2027-02-28', count: 0 },
            { date: '2027-03-01', count: 0 }, { date: '2027-03-02', count: 5 },
        ]);
        expect(fillDailyGaps([])).toEqual([]);
        expect(fillDailyGaps([{ date: '2027-03-01', count: 1 }])).toEqual([{ date: '2027-03-01', count: 1 }]);
    });

    it('formatAnswer muestra sí/no, listas y vacíos', () => {
        expect(formatAnswer(true, 'Sí', 'No')).toBe('Sí');
        expect(formatAnswer(false, 'Sí', 'No')).toBe('No');
        expect(formatAnswer(['music', 'art'], 'Sí', 'No')).toBe('music, art');
        expect(formatAnswer([], 'Sí', 'No')).toBe('—');
        expect(formatAnswer('', 'Sí', 'No')).toBe('—');
        expect(formatAnswer(3, 'Sí', 'No')).toBe('3');
        const labelOf = (v: unknown) => ({ vegan: 'Vegano', theater: 'Teatro' } as Record<string, string>)[String(v)];
        expect(formatAnswer('vegan', 'Sí', 'No', labelOf)).toBe('Vegano');
        expect(formatAnswer(['theater', 'otro'], 'Sí', 'No', labelOf)).toBe('Teatro, otro');
    });

    it('percent no divide entre cero', () => {
        expect(percent(1, 4)).toBe(25);
        expect(percent(3, 0)).toBe(0);
    });

    it('registrationQuery omite filtros vacíos y limpia el texto', () => {
        const paging = { page: 2, pageSize: 25, sort: 'last_name' as const, order: 'asc' as const };
        expect(registrationQuery({ q: '  ana ', status: '', paymentStatus: 'unpaid', conferenceId: null, checkedIn: 'false' }, paging))
            .toEqual({ page: 2, pageSize: 25, sort: 'last_name', order: 'asc', q: 'ana', paymentStatus: 'unpaid', checkedIn: 'false' });
        expect(Object.keys(registrationQuery({}, paging)).sort()).toEqual(['order', 'page', 'pageSize', 'sort']);
    });

    it('conferencesOf recorre el árbol y ordena por nombre', () => {
        const node = (id: number, type: string, name: string, children: OrgNode[] = []): OrgNode =>
            ({ id, parentId: null, type, name, shortName: null, status: 'verified', city: null, state: null, children });
        const tree = node(1, 'union', 'Union', [
            node(2, 'conference', 'Zeta', [node(4, 'church', 'Iglesia')]), node(3, 'conference', 'Alfa'),
        ]);
        expect(conferencesOf(tree).map(c => c.name)).toEqual(['Alfa', 'Zeta']);
        expect(conferencesOf(null)).toEqual([]);
    });
});
