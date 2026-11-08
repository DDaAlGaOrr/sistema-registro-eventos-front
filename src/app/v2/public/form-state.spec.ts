import { of, throwError } from 'rxjs';
import { FormState } from './form-state';
import { PublicApiService } from './public-api.service';
import { FormField, PublicForm } from './public.models';

const t = (es: string) => ({ es, en: es });

const LOCATION: FormField = { key: 'location', type: 'state_conference_picker', label: t('Ubicación'), required: true };
const CITY: FormField = { key: 'city', type: 'city_picker', label: t('Ciudad'), required: true };

const FORM = {
    id: 1, title: t('Registro'), version: 1, items: [], opensAt: null, closesAt: null, availability: 'open',
    payments: { enabled: false, online: false, offline: false, currency: 'usd' },
    schema: { steps: [{ key: 'a', title: t('A'), fields: [LOCATION, CITY] }] },
} as unknown as PublicForm;

describe('FormState: ciudad según el estado', () => {
    let requested: string[];
    let state: FormState;

    const fakeApi = (failing = false) => ({
        cities: (code: string) => {
            requested.push(code);
            return failing ? throwError(() => new Error('sin red')) : of({ cities: code === 'AZ' ? ['Phoenix', 'Tucson'] : ['Las Vegas'], available: true });
        },
        churches: () => of([]),
    }) as unknown as PublicApiService;

    beforeEach(() => {
        requested = [];
        state = new FormState(FORM, fakeApi());
    });

    it('al elegir el estado carga sus ciudades (una sola vez por estado)', () => {
        expect(state.cities()).toBeNull();
        state.set(LOCATION, { state: 'AZ', conference_id: 1 });
        expect(state.cities()).toEqual(['Phoenix', 'Tucson']);
        state.set(LOCATION, { state: 'NV', conference_id: 2 });
        expect(state.cities()).toEqual(['Las Vegas']);
        state.set(LOCATION, { state: 'AZ', conference_id: 1 });
        expect(requested).toEqual(['AZ', 'NV']);
    });

    it('cambiar de estado limpia la ciudad; cambiar solo de asociación la conserva', () => {
        state.set(LOCATION, { state: 'AZ', conference_id: 1 });
        state.set(CITY, 'Phoenix');
        state.set(LOCATION, { state: 'AZ', conference_id: 5 });
        expect(state.values()['city']).toBe('Phoenix');
        state.set(LOCATION, { state: 'NV', conference_id: 2 });
        expect(state.values()['city']).toBe('');
    });

    it('si el servicio falla el campo sigue siendo de texto libre', () => {
        state = new FormState(FORM, fakeApi(true));
        state.set(LOCATION, { state: 'AZ', conference_id: 1 });
        expect(state.cities()).toEqual([]);
        state.set(CITY, 'Pueblo Chico');
        expect(state.errors()['city']).toBeUndefined();
    });
});
