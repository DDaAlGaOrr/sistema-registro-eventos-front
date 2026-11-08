/**
 * Genera src/app/environment/environment.prod.ts con las variables de
 * entorno del build (Vercel). Angular lo usa en producción en lugar de
 * environment.ts (ver fileReplacements en angular.json).
 *
 * Variables:
 *   URL_API          URL de la API, ej. https://api.tuapp.com/api   (obligatoria)
 *   CITIES_API       API de ciudades (opcional)
 *   BASE_DOMAINS     dominios base separados por coma, ej. tuapp.com  (obligatoria)
 *   PLATFORM_SUBDOMAIN  subdominio del panel de plataforma (default: app)
 *   DEFAULT_TENANT   cliente si se abre sin subdominio (normalmente vacío en producción)
 */
const fs = require('fs');

const required = ['URL_API', 'BASE_DOMAINS'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
    console.error(`[set-env] Faltan variables de entorno: ${missing.join(', ')}`);
    process.exit(1);
}

const urlApi = process.env.URL_API.replace(/\/$/, '');
const baseDomains = process.env.BASE_DOMAINS.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
const defaultTenant = (process.env.DEFAULT_TENANT || '').trim();

const content = `// Generado por set-env.js en el build. No editar a mano.
export const URL_API = ${JSON.stringify(urlApi)};
export const API_V2 = ${JSON.stringify(`${urlApi}/v2`)};
export const CITIES_API = ${JSON.stringify(process.env.CITIES_API || 'https://countriesnow.space/api/v0.1')};
export const BASE_DOMAINS = ${JSON.stringify(baseDomains)};
export const PLATFORM_SUBDOMAIN = ${JSON.stringify(process.env.PLATFORM_SUBDOMAIN || 'app')};
export const DEFAULT_TENANT: string | null = ${defaultTenant ? JSON.stringify(defaultTenant) : 'null'};
`;

fs.mkdirSync('./src/app/environment', { recursive: true });
fs.writeFileSync('./src/app/environment/environment.prod.ts', content);
console.log(`[set-env] environment.prod.ts generado (API: ${urlApi}, dominios: ${baseDomains.join(', ')})`);
