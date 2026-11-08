import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { LanguageService } from '../../core/services/language.service';
import { ApiV2Service } from '../core/api.service';
import { I18nPipe } from '../core/i18n';
import { Permission } from '../core/models';
import { SessionService } from '../core/session.service';
import { TenantService } from '../core/tenant.service';
import { EventContextService } from './event-context.service';

interface MenuItem {
    label: string;
    icon: string;
    path: string;
    permission: Permission | Permission[];
}

/** Secciones de un evento (la ruta va después de /admin/eventos/:id/). */
export const EVENT_MENU: MenuItem[] = [
    { label: 'V2.PANEL.MENU.SUMMARY', icon: 'bi-speedometer2', path: 'resumen', permission: 'registrations.read' },
    { label: 'V2.PANEL.MENU.REGISTRATIONS', icon: 'bi-people', path: 'registros', permission: 'registrations.read' },
    { label: 'V2.PANEL.MENU.CHECKIN', icon: 'bi-qr-code-scan', path: 'checkin', permission: 'checkin.write' },
    { label: 'V2.PANEL.MENU.LOGISTICS', icon: 'bi-box-seam', path: 'logistica', permission: 'registrations.read' },
    { label: 'V2.PANEL.MENU.PAYMENTS', icon: 'bi-cash-coin', path: 'pagos', permission: 'payments.write' },
    { label: 'V2.PANEL.MENU.FORMS', icon: 'bi-ui-checks', path: 'formularios', permission: 'forms.manage' },
    { label: 'V2.PANEL.MENU.AUDIT', icon: 'bi-journal-text', path: 'auditoria', permission: 'audit.read' },
];

const CLIENT_MENU: MenuItem[] = [
    { label: 'V2.PANEL.MENU.EVENTS', icon: 'bi-calendar-event', path: '/admin/eventos', permission: 'registrations.read' },
    { label: 'V2.PANEL.MENU.CHURCHES', icon: 'bi-building', path: '/admin/iglesias', permission: 'organizations.manage' },
    { label: 'V2.PANEL.MENU.USERS', icon: 'bi-person-gear', path: '/admin/usuarios', permission: 'users.manage' },
    { label: 'V2.PANEL.MENU.SETTINGS', icon: 'bi-sliders', path: '/admin/configuracion', permission: 'tenant.settings' },
];

@Component({
    selector: 'app-panel-layout',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslateModule, I18nPipe],
    templateUrl: './panel-layout.component.html',
    styleUrls: ['./panel-layout.component.scss'],
})
export class PanelLayoutComponent implements OnInit {
    readonly session = inject(SessionService);
    readonly tenant = inject(TenantService);
    readonly context = inject(EventContextService);
    readonly language = inject(LanguageService);
    private api = inject(ApiV2Service);
    private router = inject(Router);

    readonly menuOpen = signal(false);
    readonly userMenuOpen = signal(false);
    readonly scopeName = signal<string | null>(null);
    private currentSection = signal('resumen');

    readonly eventMenu = computed(() => EVENT_MENU.filter(i => this.session.can(i.permission)));
    readonly clientMenu = computed(() => CLIENT_MENU.filter(i => this.session.can(i.permission)));
    readonly roleKey = computed(() => {
        const s = this.session.session();
        return s?.role ?? (s?.user.isPlatformAdmin ? 'platform' : null);
    });

    ngOnInit() {
        if (this.tenant.slug) this.context.load();
        // Nombre de la asociación si el usuario está limitado a una
        if (this.session.session()?.scopeOrganizationId) {
            this.api.get<{ scope: { name: string } | null }>('/auth/me')
                .subscribe({ next: me => this.scopeName.set(me.scope?.name ?? null), error: () => undefined });
        }
        this.trackSection(this.router.url);
        this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => {
            this.trackSection((e as NavigationEnd).urlAfterRedirects);
            this.menuOpen.set(false);
            this.userMenuOpen.set(false);
        });
    }

    private trackSection(url: string) {
        const match = url.match(/^\/admin\/eventos\/\d+\/([a-z-]+)/);
        if (match) this.currentSection.set(match[1]);
    }

    /** Cambiar de evento conserva la sección (de Registros de A → Registros de B). */
    changeEvent(value: string) {
        const id = Number(value);
        if (!id) return;
        this.router.navigate(['/admin/eventos', id, this.currentSection()]);
    }

    eventLink(path: string) {
        return ['/admin/eventos', this.context.currentEventId(), path];
    }

    logout() {
        this.context.reset();
        this.session.logout();
    }
}
