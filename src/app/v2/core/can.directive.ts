import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject, signal } from '@angular/core';
import { Permission } from './models';
import { SessionService } from './session.service';

/**
 * Muestra el contenido solo si el usuario tiene el permiso (o alguno de la lista):
 *   <button *appCan="'payments.write'">Registrar pago</button>
 * Es solo para la interfaz: la API vuelve a revisar cada permiso.
 */
@Directive({ selector: '[appCan]', standalone: true })
export class CanDirective {
    private template = inject(TemplateRef<unknown>);
    private container = inject(ViewContainerRef);
    private session = inject(SessionService);
    private needed = signal<Permission | Permission[] | null>(null);
    private shown = false;

    @Input() set appCan(value: Permission | Permission[]) {
        this.needed.set(value);
    }

    constructor() {
        effect(() => {
            const needed = this.needed();
            const allowed = !!needed && this.session.can(needed);
            if (allowed && !this.shown) {
                this.container.createEmbeddedView(this.template);
                this.shown = true;
            } else if (!allowed && this.shown) {
                this.container.clear();
                this.shown = false;
            }
        });
    }
}
