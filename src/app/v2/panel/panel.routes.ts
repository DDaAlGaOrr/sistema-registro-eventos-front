import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { authGuard, permissionGuard } from '../core/guards';
import { TenantService } from '../core/tenant.service';
import { EventContextService } from './event-context.service';

/** /admin → al último evento abierto, a la lista de eventos o al panel de plataforma. */
const homeRedirect: CanActivateFn = () => {
    const router = inject(Router);
    if (!inject(TenantService).slug) return router.createUrlTree(['/admin/plataforma']);
    const last = inject(EventContextService).lastEventId();
    return router.createUrlTree(last ? ['/admin/eventos', last, 'resumen'] : ['/admin/eventos']);
};

const soon = (path: string, title: string, permission: string) => ({
    path,
    canActivate: [permissionGuard],
    data: { title, permission },
    loadComponent: () => import('./pages/coming-soon.component').then(m => m.ComingSoonComponent),
});

export const PANEL_ROUTES: Routes = [
    {
        path: '',
        canActivate: [authGuard],
        loadComponent: () => import('./panel-layout.component').then(m => m.PanelLayoutComponent),
        children: [
            { path: '', pathMatch: 'full', canActivate: [homeRedirect], children: [] },
            {
                path: 'eventos',
                canActivate: [permissionGuard],
                data: { permission: 'registrations.read' },
                loadComponent: () => import('./pages/events-page.component').then(m => m.EventsPageComponent),
            },
            {
                path: 'eventos/:eventId',
                loadComponent: () => import('./pages/event-shell.component').then(m => m.EventShellComponent),
                children: [
                    { path: '', pathMatch: 'full', redirectTo: 'resumen' },
                    {
                        path: 'resumen',
                        canActivate: [permissionGuard],
                        data: { permission: 'registrations.read' },
                        loadComponent: () => import('./pages/event-summary.component').then(m => m.EventSummaryComponent),
                    },
                    // Paso 11
                    {
                        path: 'registros',
                        canActivate: [permissionGuard],
                        data: { permission: 'registrations.read' },
                        loadComponent: () => import('./registrations/registrations-page.component').then(m => m.RegistrationsPageComponent),
                    },
                    soon('checkin', 'V2.PANEL.MENU.CHECKIN', 'checkin.write'),
                    soon('logistica', 'V2.PANEL.MENU.LOGISTICS', 'registrations.read'),
                    soon('pagos', 'V2.PANEL.MENU.PAYMENTS', 'payments.write'),
                    soon('auditoria', 'V2.PANEL.MENU.AUDIT', 'audit.read'),
                    // Paso 12
                    soon('formularios', 'V2.PANEL.MENU.FORMS', 'forms.manage'),
                ],
            },
            // Paso 13
            soon('iglesias', 'V2.PANEL.MENU.CHURCHES', 'organizations.manage'),
            soon('usuarios', 'V2.PANEL.MENU.USERS', 'users.manage'),
            soon('configuracion', 'V2.PANEL.MENU.SETTINGS', 'tenant.settings'),
            {
                path: 'plataforma',
                data: { title: 'V2.AUTH.PLATFORM' },
                loadComponent: () => import('./pages/coming-soon.component').then(m => m.ComingSoonComponent),
            },
            { path: '**', redirectTo: '' },
        ],
    },
];
