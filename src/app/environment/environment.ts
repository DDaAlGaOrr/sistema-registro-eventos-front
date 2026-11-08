/**
 * Configuración para desarrollo local (ng serve).
 * En producción (Vercel) `set-env.js` genera `environment.prod.ts` con las
 * variables del proyecto y Angular lo usa en lugar de este archivo.
 */

/** API V1 (formulario público actual). */
export const URL_API = 'http://localhost:3000/api';

/** API V2 (multitenant). */
export const API_V2 = `${URL_API}/v2`;


/** Dominios base: {slug}.<dominio> identifica al cliente (pacific.localhost:4200). */
export const BASE_DOMAINS = ['localhost'];

/** Subdominio del panel de plataforma (sin cliente). */
export const PLATFORM_SUBDOMAIN = 'app';

/** Cliente cuando se abre sin subdominio (solo para desarrollo: http://localhost:4200). */
export const DEFAULT_TENANT: string | null = 'pacific';
