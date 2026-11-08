import {
    buildAnswers, canonicalCity, cleanCity, computeLines, initialValues, totalOf, validateField, validateStep, visibleKeys,
} from './form-engine';
import { FormField, FormSchema, PublicItem } from './public.models';

const t = (es: string) => ({ es, en: es });

const ITEMS: PublicItem[] = [
    {
        code: 'tshirt', kind: 'product', name: t('Playera'), description: null, priceCents: 400, isRequired: false,
        variants: [
            { code: 'XS', label: t('XS'), priceCents: 300, soldOut: false },
            { code: 'M', label: t('M'), priceCents: 400, soldOut: false },
            { code: 'XL', label: t('XL'), priceCents: 400, soldOut: true },
        ],
    },
    { code: 'lunch', kind: 'product', name: t('Comida'), description: null, priceCents: 200, isRequired: false, variants: [] },
    { code: 'fee', kind: 'registration_fee', name: t('Cuota'), description: null, priceCents: 1000, isRequired: true, variants: [] },
];

const SCHEMA: FormSchema = {
    steps: [
        {
            key: 'a', title: t('A'), fields: [
                { key: 'name', type: 'text', label: t('Nombre'), required: true, max_length: 10 },
                { key: 'wants_shirt', type: 'item_toggle', item: 'tshirt', label: t('Playera') },
                { key: 'size', type: 'item_variant', item: 'tshirt', required: true, label: t('Talla'), visible_when: { field: 'wants_shirt', equals: true } },
                { key: 'diet', type: 'select', label: t('Dieta'), required: true, options: [{ value: 'vegan', label: t('Vegana') }, { value: 'other', label: t('Otra') }] },
                { key: 'diet_note', type: 'text', label: t('Nota'), required: true, visible_when: { field: 'diet', equals: 'other' } },
                { key: 'chaperone', type: 'radio', label: t('Chaperón'), required: true, options: [{ value: true, label: t('Sí') }, { value: false, label: t('No') }] },
                { key: 'chaperone_note', type: 'text', label: t('Por qué'), visible_when: { field: 'chaperone', equals: true } },
                { key: 'wants_lunch', type: 'item_toggle', item: 'lunch', label: t('Comida') },
            ],
        },
    ],
};

const field = (key: string): FormField => SCHEMA.steps[0].fields.find(f => f.key === key)!;
const ctx = { items: ITEMS };

describe('form-engine: visibilidad', () => {
    it('un campo con condición solo se ve cuando se cumple', () => {
        const values = { ...initialValues(SCHEMA) };
        expect(visibleKeys(SCHEMA, values).has('size')).toBeFalse();
        values['wants_shirt'] = true;
        expect(visibleKeys(SCHEMA, values).has('size')).toBeTrue();
    });

    it('compara valores tipados: true (sí/no) no es lo mismo que "true"', () => {
        expect(visibleKeys(SCHEMA, { chaperone: true }).has('chaperone_note')).toBeTrue();
        expect(visibleKeys(SCHEMA, { chaperone: false }).has('chaperone_note')).toBeFalse();
        expect(visibleKeys(SCHEMA, { chaperone: 'true' }).has('chaperone_note')).toBeFalse();
    });

    it('si el campo del que depende está oculto, también se oculta', () => {
        const schema: FormSchema = {
            steps: [{
                key: 's', title: t('S'), fields: [
                    { key: 'a', type: 'checkbox', label: t('A') },
                    { key: 'b', type: 'text', label: t('B'), visible_when: { field: 'a', equals: true } },
                    { key: 'c', type: 'text', label: t('C'), visible_when: { field: 'b', not_equals: 'x' } },
                ],
            }],
        };
        // "b" oculto (a=false) → "c" también, aunque not_equals se cumpliría
        expect(visibleKeys(schema, { a: false }).has('c')).toBeFalse();
        expect(visibleKeys(schema, { a: true }).has('c')).toBeTrue();
    });

    it('in con un grupo de casillas', () => {
        const schema: FormSchema = {
            steps: [{
                key: 's', title: t('S'), fields: [
                    { key: 'g', type: 'checkbox_group', label: t('G'), options: [{ value: 'x', label: t('X') }, { value: 'y', label: t('Y') }] },
                    { key: 'h', type: 'text', label: t('H'), visible_when: { field: 'g', in: ['y'] } },
                ],
            }],
        };
        expect(visibleKeys(schema, { g: ['x'] }).has('h')).toBeFalse();
        expect(visibleKeys(schema, { g: ['x', 'y'] }).has('h')).toBeTrue();
    });
});

describe('form-engine: validación', () => {
    it('obligatorio solo cuando está visible (validateStep ignora lo oculto)', () => {
        const values = { name: 'Ana', diet: 'vegan', chaperone: false };
        const errors = validateStep(SCHEMA.steps[0], values, visibleKeys(SCHEMA, values), ctx);
        expect(errors).toEqual({});
        const other = { name: 'Ana', diet: 'other', chaperone: false };
        expect(Object.keys(validateStep(SCHEMA.steps[0], other, visibleKeys(SCHEMA, other), ctx))).toEqual(['diet_note']);
    });

    it('texto: largo máximo', () => {
        expect(validateField(field('name'), 'x'.repeat(11), ctx)).toEqual({ code: 'too_long', params: { max: 10 } });
        expect(validateField(field('name'), '  ', ctx)).toEqual({ code: 'required' });
    });

    it('correo y teléfono', () => {
        const email: FormField = { key: 'e', type: 'email', label: t('E'), required: true };
        expect(validateField(email, 'ana@correo', ctx)?.code).toBe('invalid_email');
        expect(validateField(email, 'ana@correo.com', ctx)).toBeNull();
        const phone: FormField = { key: 'p', type: 'phone', label: t('P') };
        expect(validateField(phone, '123', ctx)?.code).toBe('invalid_phone');
        expect(validateField(phone, '(602) 555-0142', ctx)).toBeNull();
        expect(validateField(phone, '', ctx)).toBeNull(); // opcional
    });

    it('número: entero y rango', () => {
        const n: FormField = { key: 'n', type: 'number', label: t('N'), integer: true, min: 0, max: 10 };
        expect(validateField(n, 'abc', ctx)?.code).toBe('invalid_number');
        expect(validateField(n, '2.5', ctx)?.code).toBe('not_integer');
        expect(validateField(n, '20', ctx)?.code).toBe('out_of_range');
        expect(validateField(n, '7', ctx)).toBeNull();
    });

    it('fecha de nacimiento: válida y no futura', () => {
        const d: FormField = { key: 'd', type: 'date', maps_to: 'birth_date', label: t('D'), required: true };
        expect(validateField(d, '2008-02-30', ctx)?.code).toBe('invalid_date');
        expect(validateField(d, '2999-01-01', ctx)?.code).toBe('future_date');
        expect(validateField(d, '2008-04-02', ctx)).toBeNull();
    });

    it('casillas: aceptar obligatorio y límites de selección', () => {
        const consent: FormField = { key: 'c', type: 'consent', label: t('C'), required: true };
        expect(validateField(consent, false, ctx)?.code).toBe('must_accept');
        expect(validateField(consent, true, ctx)).toBeNull();
        const g: FormField = { key: 'g', type: 'checkbox_group', label: t('G'), required: true, min_selected: 1, max_selected: 2,
            options: [{ value: 'a', label: t('A') }, { value: 'b', label: t('B') }, { value: 'c', label: t('C') }] };
        expect(validateField(g, [], ctx)?.code).toBe('required');
        expect(validateField(g, ['a', 'b', 'c'], ctx)).toEqual({ code: 'pick_max', params: { n: 2 } });
        expect(validateField(g, ['a'], ctx)).toBeNull();
    });

    it('opciones: solo valores del campo (incluidos sí/no booleanos)', () => {
        expect(validateField(field('diet'), 'pizza', ctx)?.code).toBe('invalid_option');
        expect(validateField(field('diet'), 'vegan', ctx)).toBeNull();
        expect(validateField(field('chaperone'), false, ctx)).toBeNull();
        expect(validateField(field('chaperone'), undefined, ctx)?.code).toBe('required');
    });

    it('talla: existe y no está agotada', () => {
        expect(validateField(field('size'), 'M', ctx)).toBeNull();
        expect(validateField(field('size'), 'XL', ctx)?.code).toBe('invalid_option');
        expect(validateField(field('size'), 'XXL', ctx)?.code).toBe('invalid_option');
    });

    it('estado/asociación e iglesia', () => {
        const loc: FormField = { key: 'l', type: 'state_conference_picker', label: t('L'), required: true };
        expect(validateField(loc, undefined, ctx)?.code).toBe('required');
        expect(validateField(loc, { state: 'AZ', conference_id: null }, ctx)?.code).toBe('required');
        expect(validateField(loc, { state: 'AZ', conference_id: 3 }, ctx)).toBeNull();
        const church: FormField = { key: 'ch', type: 'church_picker', label: t('Ch'), required: true, allow_new: true };
        expect(validateField(church, undefined, ctx)?.code).toBe('required');
        expect(validateField(church, { new_name: ' ' }, ctx)?.code).toBe('required');
        expect(validateField(church, { new_name: 'A' }, ctx)?.code).toBe('too_short');
        expect(validateField(church, { new_name: 'Nueva Esperanza' }, ctx)).toBeNull();
        expect(validateField(church, { church_id: 9 }, ctx)).toBeNull();
    });
});

describe('form-engine: respuestas y total', () => {
    it('buildAnswers: solo campos visibles, con tipos correctos', () => {
        const values = {
            name: ' Ana ', wants_shirt: false, size: 'M', diet: 'vegan', diet_note: 'no va', chaperone: true,
            chaperone_note: '', wants_lunch: true,
        };
        const answers = buildAnswers(SCHEMA, values, visibleKeys(SCHEMA, values));
        expect(answers).toEqual({ name: 'Ana', wants_shirt: false, diet: 'vegan', chaperone: true, wants_lunch: true });
        // "size" (oculta por wants_shirt=false) y "diet_note" (oculta por diet) no se mandan
        expect('size' in answers).toBeFalse();
        expect('diet_note' in answers).toBeFalse();
    });

    it('buildAnswers: selectores de sistema con el formato de la API', () => {
        const schema: FormSchema = {
            steps: [{
                key: 's', title: t('S'), fields: [
                    { key: 'l', type: 'state_conference_picker', label: t('L') },
                    { key: 'ch', type: 'church_picker', label: t('Ch') },
                    { key: 'n', type: 'number', label: t('N') },
                ],
            }],
        };
        const values = { l: { state: 'AZ', conference_id: 3 }, ch: { new_name: ' Nueva ' }, n: '4' };
        expect(buildAnswers(schema, values, visibleKeys(schema, values))).toEqual({
            l: { state: 'AZ', conference_id: 3 }, ch: { new_name: 'Nueva' }, n: 4,
        });
    });

    it('ciudad: se limpia y se iguala a la escritura de la lista', () => {
        const cities = ['Phoenix', 'Álamo', 'San José'];
        expect(cleanCity('  Los   Angeles ')).toBe('Los Angeles');
        expect(canonicalCity(cities, 'phoenix ')).toBe('Phoenix');
        expect(canonicalCity(cities, 'ALAMO')).toBe('Álamo');
        expect(canonicalCity(cities, 'san  jose')).toBe('San José');
        expect(canonicalCity(cities, ' Pueblo   Chico ')).toBe('Pueblo Chico'); // fuera de la lista: solo se limpia
        expect(canonicalCity([], '  phoenix ')).toBe('phoenix');

        const city: FormField = { key: 'city', type: 'city_picker', label: t('Ciudad'), required: true };
        expect(validateField(city, '   ', { items: ITEMS })?.code).toBe('required');
        expect(validateField(city, 'x'.repeat(121), { items: ITEMS })?.code).toBe('too_long');
        expect(validateField(city, 'Phoenix', { items: ITEMS })).toBeNull();
        const schema: FormSchema = { steps: [{ key: 's', title: t('S'), fields: [city] }] };
        const values = { city: '  Los   Angeles ' };
        expect(buildAnswers(schema, values, visibleKeys(schema, values))).toEqual({ city: 'Los Angeles' });
    });

    it('total: precio de la talla, producto sin talla y cuota obligatoria automática', () => {
        const values = { wants_shirt: true, size: 'XS', wants_lunch: true };
        const lines = computeLines(SCHEMA, ITEMS, values, visibleKeys(SCHEMA, values));
        expect(lines.map(l => [l.item.code, l.priceCents])).toEqual([['tshirt', 300], ['lunch', 200], ['fee', 1000]]);
        expect(totalOf(lines)).toBe(1500);
    });

    it('total: lo oculto o sin marcar no se cobra', () => {
        const values = { wants_shirt: false, size: 'XS', wants_lunch: false };
        const lines = computeLines(SCHEMA, ITEMS, values, visibleKeys(SCHEMA, values));
        expect(lines.map(l => l.item.code)).toEqual(['fee']);
    });

    it('total: playera marcada sin talla cobra el precio base', () => {
        const values = { wants_shirt: true };
        const lines = computeLines(SCHEMA, ITEMS, values, visibleKeys(SCHEMA, values));
        expect(lines.find(l => l.item.code === 'tshirt')?.priceCents).toBe(400);
    });
});
