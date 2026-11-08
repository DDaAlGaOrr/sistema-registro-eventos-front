import { Routes } from '@angular/router';
import { guestGuard } from './v2/core/guards';

export const routes: Routes = [
  // ── Sitio público del cliente (formulario de registro) ───────────────
  {
    path: '',
    loadComponent: () => import('./v2/public/public-shell.component').then(m => m.PublicShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./v2/public/public-home.component').then(m => m.PublicHomeComponent),
      },
      {
        path: 'evento/:slug',
        loadComponent: () => import('./v2/public/event-page.component').then(m => m.EventPageComponent),
      },
      {
        path: 'evento/:slug/registro/:formId',
        loadComponent: () => import('./v2/public/registration-page.component').then(m => m.RegistrationPageComponent),
      },
      // A donde lleva el correo de confirmación y el regreso de Stripe
      {
        path: 'registro/confirmacion/:code',
        loadComponent: () => import('./v2/public/confirmation-page.component').then(m => m.ConfirmationPageComponent),
      },
      // Enlaces viejos de la versión 1 (/registro/2): al inicio del cliente
      { path: 'registro/:id', redirectTo: '' },
      { path: 'registro', redirectTo: '' },
    ],
  },

  // ── Acceso al panel ──────────────────────────────────────────────────
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

  // ── Panel de administración ──────────────────────────────────────────
  {
    path: 'admin',
    loadChildren: () => import('./v2/panel/panel.routes').then(m => m.PANEL_ROUTES),
  },

  { path: '**', redirectTo: '' },
];
