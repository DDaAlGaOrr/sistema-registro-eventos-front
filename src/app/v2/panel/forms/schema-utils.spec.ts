import { FormField, FormSchema } from '../../public/public.models';
import {
    conditionChoices, fieldsBefore, localIssues, locatePath, moveInArray, newField, sanitizeField, sanitizeSchema, slugKey, starterSchema,
} from './schema-utils';

const t = (es: string, en = es) => ({ es, en });

describe('constructor de formularios: utilidades', () => {
    it('slugKey: sin acentos, minúsculas, empieza con letra y es única', () => {
        const taken = new Set(['talla_de_playera']);
        expect(slugKey('Talla de playera', new Set())).toBe('talla_de_playera');
        expect(slugKey('Talla de playera', taken)).toBe('talla_de_playera_2');
        expect(slugKey('Año / Niño', new Set())).toBe('ano_nino');
        expect(slugKey('123 abc', new Set())).toBe('campo_123_abc');
        expect(slugKey('¿¿??', new Set())).toBe('campo');
        expect(slugKey('x'.repeat(80), new Set()).length).toBeLessThanOrEqual(50);
    });

    it('newField: opciones iniciales para listas y producto vacío para los de producto', () => {
        const radio = newField('radio', new Set());
        expect(radio.options?.length).toBe(2);
        expect(newField('item_variant', new Set()).item).toBe('');
        expect(newField('church_picker', new Set()).allow_new).toBeTrue();
        expect(newField('text', new Set(['texto_corto'])).key).toBe('texto_corto_2');
    });

    it('sanitizeField: solo deja lo que el tipo acepta y quita lo vacío', () => {
        const dirty = {
            key: 'edad', type: 'number', label: t(' Edad ', ' Age '), required: true, help: t('Ayuda', ''),
            min: 0, max: undefined, integer: true, max_length: 5, options: [{ value: 'a', label: t('A') }], maps_to: '',
        } as unknown as FormField;
        expect(sanitizeField(dirty)).toEqual({ key: 'edad', type: 'number', label: t('Edad', 'Age'), required: true, min: 0, integer: true } as FormField);
    });

    it('sanitizeField: opciones con texto limpio, ayuda completa y condición válida', () => {
        const field = {
            key: 'dieta', type: 'select', label: t('Dieta', 'Diet'), required: false, help: t('Ayuda', 'Help'),
            options: [{ value: ' vegan ', label: t(' Vegano ', ' Vegan ') }], visible_when: { field: 'comida', equals: true },
        } as unknown as FormField;
        expect(sanitizeField(field)).toEqual({
            key: 'dieta', type: 'select', label: t('Dieta', 'Diet'), required: false, help: t('Ayuda', 'Help'),
            options: [{ value: 'vegan', label: t('Vegano', 'Vegan') }], visible_when: { field: 'comida', equals: true },
        } as unknown as FormField);
        // Una condición sin valor se descarta
        expect(sanitizeField({ ...field, visible_when: { field: 'comida' } }).visible_when).toBeUndefined();
        expect(sanitizeField({ ...field, visible_when: { field: 'comida', in: [] } }).visible_when).toBeUndefined();
    });

    it('sanitizeSchema conserva pasos, descripción y campos en orden', () => {
        const schema: FormSchema = starterSchema();
        schema.steps[0].description = t('Cuéntanos de ti', '');
        const out = sanitizeSchema(schema);
        expect(out.steps[0].description).toBeUndefined(); // media traducción: no se manda
        expect(out.steps[0].fields.map(f => f.key)).toEqual(['first_name', 'last_name', 'email', 'phone']);
    });

    it('starterSchema trae los tres datos obligatorios para publicar', () => {
        const fields = starterSchema().steps[0].fields;
        for (const col of ['first_name', 'last_name', 'email']) {
            const f = fields.find(x => x.maps_to === col);
            expect(f?.required).toBeTrue();
            expect(f?.visible_when).toBeUndefined();
        }
    });

    it('moveInArray mueve sin salirse de los límites', () => {
        expect(moveInArray([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
        expect(moveInArray([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
        expect(moveInArray([1, 2, 3], 1, 99)).toEqual([1, 3, 2]);
        expect(moveInArray([1, 2, 3], 9, 0)).toEqual([1, 2, 3]);
    });

    it('fieldsBefore: solo campos anteriores, también de pasos previos', () => {
        const schema: FormSchema = {
            steps: [
                { key: 'a', title: t('A'), fields: [{ key: 'f1', type: 'text', label: t('1') }, { key: 'f2', type: 'text', label: t('2') }] },
                { key: 'b', title: t('B'), fields: [{ key: 'f3', type: 'text', label: t('3') }, { key: 'f4', type: 'text', label: t('4') }] },
            ],
        };
        expect(fieldsBefore(schema, 1, 1).map(f => f.key)).toEqual(['f1', 'f2', 'f3']);
        expect(fieldsBefore(schema, 0, 0)).toEqual([]);
    });

    it('conditionChoices: opciones, sí/no o texto libre', () => {
        expect(conditionChoices({ key: 'g', type: 'radio', label: t('G'), options: [{ value: 'a', label: t('A') }] })?.length).toBe(1);
        expect(conditionChoices({ key: 'c', type: 'checkbox', label: t('C') })?.map(c => c.value)).toEqual([true, false]);
        expect(conditionChoices({ key: 'n', type: 'text', label: t('N') })).toBeNull();
    });

    it('locatePath entiende los dos formatos de ruta', () => {
        expect(locatePath('steps[1].fields[3].label')).toEqual({ stepIndex: 1, fieldIndex: 3 });
        expect(locatePath('steps.2.fields.0.options')).toEqual({ stepIndex: 2, fieldIndex: 0 });
        expect(locatePath('steps[0].key')).toEqual({ stepIndex: 0, fieldIndex: null });
        expect(locatePath('steps')).toEqual({ stepIndex: null, fieldIndex: null });
    });

    it('localIssues: traducciones faltantes, opciones y producto sin elegir', () => {
        const schema: FormSchema = {
            steps: [{
                key: 'a', title: t('Paso', ''), fields: [
                    { key: 'f1', type: 'text', label: t('Nombre', '') },
                    { key: 'f2', type: 'text', label: t('Ok', 'Ok'), help: t('Solo español', '') },
                    { key: 'f3', type: 'select', label: t('Lista', 'List'), options: [{ value: 'a', label: t('A', 'A') }, { value: 'a', label: t('B', '') }] },
                    { key: 'f4', type: 'item_variant', label: t('Talla', 'Size'), item: '' },
                    { key: 'f5', type: 'text', label: t('Otro', 'Other'), visible_when: { field: 'f1' } },
                ],
            }],
        };
        const codes = localIssues(schema).map(i => `${i.fieldIndex ?? 'step'}:${i.code}`);
        expect(codes).toEqual(['step:step_title', '0:label', '1:help', '2:option_label', '2:option_repeated', '3:item_missing', '4:condition_incomplete']);
        expect(localIssues(starterSchema())).toEqual([]);
    });
});
