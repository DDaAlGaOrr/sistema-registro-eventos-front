# Sistema de registro de eventos — Front

Angular 17 (componentes standalone, Bootstrap 5, ngx-translate). Panel de
administración V2 (multitenant) y formulario público.

## Arranque local

```bash
npm install
npx ng serve            # http://localhost:4200
```

Necesita la API corriendo en `http://localhost:3000` (repo
`sistema-registro-eventos-backend`). La configuración local está en
`src/app/environment/environment.ts`:

| Constante | Para qué |
|---|---|
| `URL_API` / `API_V2` | API V1 (`/api`) y V2 (`/api/v2`) |
| `BASE_DOMAINS` | Dominios base: `{slug}.<dominio>` identifica al cliente |
| `PLATFORM_SUBDOMAIN` | `app.<dominio>` = panel de plataforma (sin cliente) |
| `DEFAULT_TENANT` | Cliente cuando se abre sin subdominio (`http://localhost:4200` → `pacific`) |

Para probar otro cliente en local: `http://<slug>.localhost:4200` (Chrome,
Edge y Firefox resuelven `*.localhost` solos).

## Producción (Vercel)

`npm run build` corre `set-env.js`, que genera `environment.prod.ts` con estas
variables del proyecto en Vercel (sin ellas el build falla a propósito):

| Variable | Ejemplo | Obligatoria |
|---|---|---|
| `URL_API` | `https://api.tuapp.com/api` | sí |
| `BASE_DOMAINS` | `tuapp.com` | sí |
| `PLATFORM_SUBDOMAIN` | `app` | no |
| `DEFAULT_TENANT` | (vacío) | no |
| `CITIES_API` | | no |

## Estructura

```
src/app/
  v2/core/     sesión, cliente (tenant), API V2, interceptor, guards, *appCan, i18n
  v2/auth/     login, recuperar, restablecer, invitación
  v2/panel/    layout del panel, selector de evento y páginas
  features/    formulario público (V1; se reemplaza en el Paso 10)
```

- **Cliente:** se detecta por subdominio al arrancar (`TenantService`), se
  carga su marca (`/api/v2/tenant/public`) y se aplica: colores como
  variables CSS (`--brand-primary`), logo y título.
- **Sesión:** el access token vive solo en memoria; el refresh token en una
  cookie httpOnly. Al recargar la página la sesión se recupera sola; si un
  pedido responde 401 se renueva una vez y se repite.
- **Permisos:** `session.can('payments.write')` y `*appCan="'payments.write'"`
  solo ocultan cosas en pantalla; la API vuelve a revisar todo.
- **Idiomas:** textos fijos en `src/assets/i18n/{es,en}.json` (sección `V2`);
  los textos de la API vienen como `{es, en}` y se muestran con el pipe `i18n`.
