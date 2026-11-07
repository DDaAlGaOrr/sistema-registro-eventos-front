import { Component, OnDestroy, OnInit } from '@angular/core';
import { StepperSidebarComponent } from '../../../shared/components/stepper-sidebar/stepper-sidebar.component';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { TopbarMobileComponent } from '../../../shared/components/topbar-mobile/topbar-mobile.component';
import { FooterBarComponent } from '../../../shared/components/footer-bar/footer-bar.component';
import { FormGroup } from '@angular/forms';
import { RegistrationFormService } from '../../../core/services/registration-form.service';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  standalone: true,
  imports: [StepperSidebarComponent, CommonModule, RouterOutlet, TopbarMobileComponent, FooterBarComponent, TranslateModule],
  selector: 'app-registration-layout',
  templateUrl: './registration-layout.component.html',
  styleUrls: ['./registration-layout.component.scss']
})
export class RegistrationLayoutComponent implements OnInit, OnDestroy {

  activeStep: number = 0;
  readonly totalSteps: number = 5;
  stepperForm!: FormGroup;

  private readonly stepRoutes = [
    'info-general',       // Paso 0
    'datos-personales',   // Paso 1
    'contacto-emergencia',// Paso 2
    'resumen',            // Paso 3
    'confirmacion',       // Paso 4
    'recibido'            // Paso 5
  ];

  private destroy$ = new Subject<void>();
  // Propiedad para almacenar la referencia del temporizador
  private redirectTimeout: any;

  constructor(
    public languageService: LanguageService,
    private registrationFormService: RegistrationFormService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.listenToRouteChanges();
  }

  ngOnInit(): void {
    this.stepperForm = this.registrationFormService.stepperForm;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // CRÍTICO: Limpiar el timeout si el componente se destruye antes de los 10 segundos
    this.clearRedirectTimeout();
  }

  private listenToRouteChanges(): void {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      const urlSegment = event.urlAfterRedirects.split('/').pop() || '';

      if (urlSegment === 'registro') {
        this.activeStep = 0;
        return;
      }

      const index = this.stepRoutes.indexOf(urlSegment);
      if (index !== -1) {
        this.activeStep = index;
      }
    });
  }

  get isCurrentStepValid(): boolean {
    if (this.activeStep === 0 || this.activeStep === this.totalSteps) return true;
    const currentFormGroup = this.stepperForm.get(`paso${this.activeStep}`);
    return currentFormGroup ? currentFormGroup.valid : true;
  }

  avanzarPaso(): void {
    if (!this.isCurrentStepValid) return;

    if (this.activeStep === 4) {
      this.enviarFormulario();
      return;
    }

    if (this.activeStep < this.totalSteps) {
      this.activeStep++;
      this.navigateToStep(this.activeStep);
    }
  }

  retrocederPaso(): void {
    // Bloqueamos el retroceso si ya está en el paso final ('recibido')
    if (this.activeStep > 0 && this.activeStep < this.totalSteps) {
      this.activeStep--;
      this.navigateToStep(this.activeStep);
    }
  }

  private navigateToStep(stepIndex: number): void {
    const route = this.stepRoutes[stepIndex];
    const eventId = this.route.snapshot.paramMap.get('id') || this.route.snapshot.parent?.paramMap.get('id');
    this.router.navigate(['/registro', eventId, route]);

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  enviarFormulario(): void {
    if (this.stepperForm.valid) {
      console.log('¡Formulario enviado con éxito!', this.stepperForm.value);

      // 1. Avanzar a la pantalla de éxito
      this.activeStep = 5;
      this.navigateToStep(this.activeStep);

      // 2. Iniciar la cuenta regresiva para reiniciar el flujo
      this.startAutomaticReset();
    } else {
      console.error('El formulario general contiene errores.');
    }
  }

  /**
   * Inicia el temporizador de 10 segundos para resetear el formulario y volver al inicio.
   */
  private startAutomaticReset(): void {
    this.clearRedirectTimeout(); // Limpieza preventiva

    this.redirectTimeout = setTimeout(() => {
      this.reiniciarFormularioCompleto();
    }, 10000); // 10000 milisegundos = 10 segundos
  }

  /**
   * Resetea el estado del formulario centralizado y redirige al Paso 0.
   */
  private reiniciarFormularioCompleto(): void {
    // Resetea los valores del FormGroup y limpia validaciones
    if (this.stepperForm) {
      this.stepperForm.reset();
    }

    // Regresa al primer paso de la secuencia (Paso 0)
    this.activeStep = 0;
    this.navigateToStep(this.activeStep);
  }

  /**
   * Cancela de forma segura el temporizador activo.
   */
  private clearRedirectTimeout(): void {
    if (this.redirectTimeout) {
      clearTimeout(this.redirectTimeout);
    }
  }
}
