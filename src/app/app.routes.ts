import { Routes } from '@angular/router';
import { guestGuard } from './v2/core/guards';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'registro/2',
    pathMatch: 'full'
  },

  // ── Acceso al panel (V2) ─────────────────────────────────────────────
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./v2/auth/login.component').then(m => m.LoginV2Component),
  },
  {
    path: 'recuperar',
    loadComponent: () => import('./v2/auth/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'restablecer',
    data: { mode: 'reset' },
    loadComponent: () => import('./v2/auth/set-password.component').then(m => m.SetPasswordComponent),
  },
  {
    path: 'invitacion',
    data: { mode: 'invite' },
    loadComponent: () => import('./v2/auth/set-password.component').then(m => m.SetPasswordComponent),
  },

  // ── Panel de administración (V2) ─────────────────────────────────────
  {
    path: 'admin',
    loadChildren: () => import('./v2/panel/panel.routes').then(m => m.PANEL_ROUTES),
  },

  // ── Formulario público (V1, se reemplaza en el Paso 10) ──────────────
  {
    path: 'registro',
    loadChildren: () =>
      import('./features/registration/registration.routes').then(m => m.REGISTRATION_ROUTES)
  },
  {
    path: '**',
    redirectTo: 'registro/2'
  }
];
