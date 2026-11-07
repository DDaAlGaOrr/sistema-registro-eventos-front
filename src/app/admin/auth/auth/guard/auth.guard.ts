import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../service/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) return true;

  router.navigate(['/login']);
  return false;
};

export const eventGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Si ni siquiera está logueado, al login
  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return true;
  }

  const user = authService.getUser();
  const eventRequired = route.data['event']; // Ej: 'congreso'

  // 2. Lógica de autorización básica:
  // Si es 'admin' general, tiene acceso completo al congreso
  if (user && (user.role === 'superadmin' ||
    user.role === "finanzas" ||
    user.role === "staff" ||
    user.role === "admin" ||
    user.role === "vicePresident" ||
    user.role === "developer"
  )) {
    return true;
  }

  // Si no cumple las condiciones, redirigir a una página segura o unauthorized
  router.navigate(['/admin/unauthorized']);
  return false;
};
