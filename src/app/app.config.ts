import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { apiV2Interceptor } from './v2/core/api.interceptor';
import { TenantService } from './v2/core/tenant.service';

import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),

    provideHttpClient(
      withInterceptors([apiV2Interceptor])
    ),

    // Antes de pintar nada: qué cliente es (subdominio) y su marca
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [TenantService],
      useFactory: (tenant: TenantService) => () => tenant.load(),
    },

    provideTranslateService({
      fallbackLang: 'es',
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json',
      }),
    }),
  ],
};
