import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'registro/2',
    pathMatch: 'full'
  },
  // Ruta de Login limpia (apunta a tu AuthComponent dentro de la carpeta admin/auth)
  {
    path: 'login',
    loadComponent: () =>
      import('./admin/auth/auth/auth.component').then(m => m.AuthComponent)
  },
  // Rama Registro
  {
    path: 'registro',
    loadChildren: () =>
      import('./features/registration/registration.routes').then(m => m.REGISTRATION_ROUTES)
  },
  // Rama Admin protegida
  {
    path: 'admin',
    loadChildren: () =>
      import('./admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },
  {
    path: '**',
    redirectTo: 'registro/2'
  }
];
