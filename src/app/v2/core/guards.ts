import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { Permission } from './models';
import { SessionService } from './session.service';

/** Exige sesión; si la cookie sigue vigente, la recupera sin pedir login. */
export const authGuard: CanActivateFn = async (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const session = inject(SessionService);
    const router = inject(Router);
    if (await session.restore()) return true;
    return router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
};

/** Para login/recuperar: si ya hay sesión, directo al panel. */
export const guestGuard: CanActivateFn = async () => {
    const session = inject(SessionService);
    const router = inject(Router);
    return (await session.restore()) ? router.createUrlTree(['/admin']) : true;
};

/** Ruta que exige un permiso (data: { permission }). Sin permiso vuelve al inicio del panel. */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
    const session = inject(SessionService);
    const router = inject(Router);
    const needed = route.data['permission'] as Permission | Permission[] | undefined;
    if (!needed || session.can(needed)) return true;
    return router.createUrlTree(['/admin']);
};
