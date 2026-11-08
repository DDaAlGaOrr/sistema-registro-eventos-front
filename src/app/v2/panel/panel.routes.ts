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
                    {
                        path: 'checkin',
                        canActivate: [permissionGuard],
                        data: { permission: 'checkin.write' },
                        loadComponent: () => import('./checkin/checkin-page.component').then(m => m.CheckinPageComponent),
                    },
                    {
                        path: 'logistica',
                        canActivate: [permissionGuard],
                        data: { permission: 'registrations.read' },
                        loadComponent: () => import('./logistics/logistics-page.component').then(m => m.LogisticsPageComponent),
                    },
                    {
                        path: 'pagos',
                        canActivate: [permissionGuard],
                        data: { permission: 'payments.write' },
                        loadComponent: () => import('./payments/payments-page.component').then(m => m.PaymentsPageComponent),
                    },
                    {
                        path: 'auditoria',
                        canActivate: [permissionGuard],
                        data: { permission: 'audit.read' },
                        loadComponent: () => import('./audit/audit-page.component').then(m => m.AuditPageComponent),
                    },
                    {
                        path: 'formularios',
                        canActivate: [permissionGuard],
                        data: { permission: 'forms.manage' },
                        children: [
                            {
                                path: '',
                                pathMatch: 'full',
                                loadComponent: () => import('./forms/forms-list-page.component').then(m => m.FormsListPageComponent),
                            },
                            {
                                path: ':formId',
                                canDeactivate: [(c: import('./forms/form-editor-page.component').FormEditorPageComponent) => c.confirmLeave()],
                                loadComponent: () => import('./forms/form-editor-page.component').then(m => m.FormEditorPageComponent),
                            },
                        ],
                    },
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
