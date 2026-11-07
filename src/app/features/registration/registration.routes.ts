import { Routes } from '@angular/router';
import { RegistrationLayoutComponent } from './registration-layout/registration-layout.component';

export const REGISTRATION_ROUTES: Routes = [
  {
    path: ':id',
    component: RegistrationLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/info-general/info-general.component').then(m => m.InfoGeneralComponent)
      },
      {
        path: 'datos-personales',
        loadComponent: () => import('./pages/step1-datos-personales/step1-datos-personales.component').then(m => m.Step1DatosPersonalesComponent)
      },
      {
        path: 'contacto-emergencia',
        loadComponent: () => import('./pages/step2-contacto-emergencia/step2-contacto-emergencia.component').then(m => m.Step2ContactoEmergenciaComponent)
      },
      {
        path: 'resumen',
        loadComponent: () => import('./pages/step3-resumen/step3-resumen.component').then(m => m.Step3ResumenComponent)
      },
      {
        path: 'confirmacion',
        loadComponent: () => import('./pages/step4-confirmacion/step4-confirmacion.component').then(m => m.Step4ConfirmacionComponent)
      },
      {
        path: 'recibido',
        loadComponent: () => import('./pages/step5-recibido/step5-recibido.component').then(m => m.Step5RecibidoComponent)
      },
    ]
  }
];
