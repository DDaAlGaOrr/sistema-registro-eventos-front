import { Component, Input, OnInit } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-topbar-mobile',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './topbar-mobile.component.html',
  styleUrls: ['./topbar-mobile.component.scss']
})
export class TopbarMobileComponent {

  // Puedes cambiar estos valores manualmente o pasarlos como @Input()
  @Input() currentStep: number = 0;
  @Input() totalSteps: number = 5;

  constructor(
    public languageService: LanguageService,
    private translate: TranslateService,
  ) { }

  // Keys de traducción en vez de texto hardcodeado.
  // Índice 0 = pantalla de información general, índices 1-5 = SIDEBAR.STEP1..STEP5
  readonly stepTitleKeys = [
    'INFO.TITLE',
    'SIDEBAR.STEP1',
    'SIDEBAR.STEP2',
    'SIDEBAR.STEP3',
    'SIDEBAR.STEP4',
    'SIDEBAR.STEP5'
  ];

  get currentTitle(): string {
    const key = this.stepTitleKeys[this.currentStep];
    return key ? this.translate.instant(key) : '';
  }

  get nextTitle(): string {
    if (this.currentStep < this.totalSteps) {
      const key = this.stepTitleKeys[this.currentStep + 1];
      const nextStepTitle = key ? this.translate.instant(key) : '';
      const nextLabel = this.translate.instant('FOOTER.NEXT');
      return `${nextLabel} - ${nextStepTitle}`;
    }
    return '';
  }

  // Circunferencia del círculo (2 * Math.PI * r) -> 2 * 3.1416 * 40 = ~251.2
  readonly circumference = 251.2;

  // Calcula cuánto se debe "esconder" del trazo verde
  get strokeDashoffset(): number {
    if (this.totalSteps <= 0) return this.circumference;

    // Validamos que el paso actual no supere el total
    const current = Math.min(Math.max(this.currentStep, 0), this.totalSteps);
    const percentage = current / this.totalSteps;

    // Si es 0, mostramos un pequeño porcentaje mínimo para que se vea el "punto" inicial redondeado de tu UI
    if (current === 0) {
      return this.circumference - 3;
    }

    return this.circumference - (percentage * this.circumference);
  }

}
