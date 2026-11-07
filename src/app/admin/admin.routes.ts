import { Routes } from '@angular/router';
import { authGuard, eventGuard } from './auth/auth/guard/auth.guard';
import { LogsAdminComponent } from './features/congreso-union/logs-admin/logs-admin.component';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/admin-layout/admin-layout.component').then(
        (m) => m.AdminLayoutComponent,
      ),
    children: [
      {
        path: '',
        redirectTo: 'congreso/overview',
        pathMatch: 'full',
      },

      // ── Congreso Union ─────────────────────────────────────────────────────
      {
        path: 'congreso',
        canActivateChild: [eventGuard],
        data: { event: 'congreso' },
        children: [
          /* { path: '', redirectTo: 'overview', pathMatch: 'full' }, */
          {
            path: 'overview',
            data: { event: 'congreso' },
            loadComponent: () =>
              import('./features/congreso-union/overview-congreso/overview-congreso.component')
                .then(m => m.OverviewCongresoComponent),
          },
          {
            path: 'registered',
            data: { event: 'congreso' },
            loadComponent: () =>
              import('./features/congreso-union/registrados/registrados.component')
                .then(m => m.RegistradosComponent),
          },
          {
            path: 'checkin',
            data: { event: 'congreso' },
            loadComponent: () =>
              import('./features/congreso-union/checkin/checkin.component')
                .then(m => m.CheckinComponent),
          },
          {
            path: 'products',
            data: { event: 'congreso' },
            loadComponent: () =>
              import('./features/congreso-union/productos/productos.component')
                .then(m => m.ProductosComponent),
          },
          {
            path: 'logs',
            data: { event: 'congreso' },
            loadComponent: () =>
              import('./features/congreso-union/logs-admin/logs-admin.component')
                .then(m => m.LogsAdminComponent),
          },
        ],
      },
    ],
  },
];
