import { FormSchema } from '../../public/public.models';
import { BuilderState } from './builder-state';
import { starterSchema } from './schema-utils';

const t = (es: string, en = es) => ({ es, en });

const base = (): FormSchema => ({
    steps: [
        { key: 'uno', title: t('Uno'), fields: [
            { key: 'comida', type: 'checkbox', label: t('Comida') },
            { key: 'dieta', type: 'select', label: t('Dieta'), options: [{ value: 'a', label: t('A') }], visible_when: { field: 'comida', equals: true } },
        ] },
        { key: 'dos', title: t('Dos'), fields: [] },
    ],
});

describe('BuilderState', () => {
    it('dirty: cambia al editar y se limpia al marcar guardado', () => {
        const s = new BuilderState(base());
        expect(s.dirty()).toBeFalse();
        s.updateField(0, 0, { required: true });
        expect(s.dirty()).toBeTrue();
        s.markSaved();
        expect(s.dirty()).toBeFalse();
    });

    it('dirty: deshacer a mano el cambio vuelve a limpio', () => {
        const s = new BuilderState(base());
        s.updateField(0, 0, { label: t('Otro') });
        expect(s.dirty()).toBeTrue();
        s.updateField(0, 0, { label: t('Comida') });
        expect(s.dirty()).toBeFalse();
    });

    it('addField agrega con clave única y lo selecciona; addStep también', () => {
        const s = new BuilderState(base());
        s.addField(1, 'text');
        s.addField(1, 'text');
        expect(s.schema().steps[1].fields.map(f => f.key)).toEqual(['texto_corto', 'texto_corto_2']);
        expect(s.selection()).toEqual({ step: 1, field: 1 });
        s.addStep();
        expect(s.schema().steps.length).toBe(3);
        expect(s.selection()).toEqual({ step: 2, field: null });
        expect(new Set(s.schema().steps.map(x => x.key)).size).toBe(3);
    });

    it('campos de sistema únicos: isTypeUsed', () => {
        const s = new BuilderState(base());
        expect(s.isTypeUsed('state_conference_picker')).toBeFalse();
        s.addField(0, 'state_conference_picker');
        expect(s.isTypeUsed('state_conference_picker')).toBeTrue();
        expect(s.isTypeUsed('text')).toBeFalse(); // los comunes pueden repetirse
    });

    it('borrar un campo quita las condiciones que dependían de él', () => {
        const s = new BuilderState(base());
        s.removeField(0, 0);
        expect(s.schema().steps[0].fields.map(f => f.key)).toEqual(['dieta']);
        expect(s.schema().steps[0].fields[0].visible_when).toBeUndefined();
    });

    it('renameField actualiza las condiciones y rechaza claves repetidas o inválidas', () => {
        const s = new BuilderState(base());
        expect(s.renameField(0, 0, 'quiere_comida')).toBeTrue();
        expect(s.schema().steps[0].fields[1].visible_when?.field).toBe('quiere_comida');
        expect(s.renameField(0, 0, 'dieta')).toBeFalse();
        expect(s.renameField(0, 0, 'Mala Clave')).toBeFalse();
        expect(s.schema().steps[0].fields[0].key).toBe('quiere_comida');
    });

    it('moveField dentro del paso y entre pasos', () => {
        const s = new BuilderState(base());
        s.moveField(0, 0, 0, 1);
        expect(s.schema().steps[0].fields.map(f => f.key)).toEqual(['dieta', 'comida']);
        s.moveField(0, 0, 1, 0);
        expect(s.schema().steps[0].fields.map(f => f.key)).toEqual(['comida']);
        expect(s.schema().steps[1].fields.map(f => f.key)).toEqual(['dieta']);
        expect(s.selection()).toEqual({ step: 1, field: 0 });
    });

    it('removeStep y moveStep ajustan la selección', () => {
        const s = new BuilderState(base());
        s.moveStep(0, 1);
        expect(s.schema().steps.map(x => x.key)).toEqual(['dos', 'uno']);
        s.removeStep(1);
        expect(s.schema().steps.map(x => x.key)).toEqual(['dos']);
        expect(s.selection()).toEqual({ step: 0, field: null });
        s.removeStep(0);
        expect(s.selection()).toBeNull();
    });

    it('replace (datos básicos) cuenta como cambio y revisa traducciones', () => {
        const s = new BuilderState({ steps: [] });
        s.replace(starterSchema());
        expect(s.dirty()).toBeTrue();
        expect(s.issues()).toEqual([]);
        s.updateField(0, 0, { label: { es: 'Nombre', en: '' } });
        expect(s.issues().map(i => i.code)).toEqual(['label']);
    });
});
