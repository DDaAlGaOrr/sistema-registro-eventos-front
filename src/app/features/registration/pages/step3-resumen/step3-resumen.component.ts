import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistrationFormService } from '../../../../core/services/registration-form.service';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-step3-resumen',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './step3-resumen.component.html',
  styleUrl: './step3-resumen.component.scss'
})
export class Step3ResumenComponent {
  private formService = inject(RegistrationFormService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  eventId: string | null = null;

  ngOnInit(): void {
    this.route.parent?.paramMap.subscribe(params => {
      this.eventId = params.get('id');
    });
  }

  get paso1Value() {
    return this.formService.stepperForm.get('paso1')?.value || {};
  }

  get paso2Value() {
    return this.formService.stepperForm.get('paso2')?.value || {};
  }

  get nombreCompleto(): string {
    const val = this.paso1Value;
    const name = val.name || '';
    const lastname = val.lastname || '';

    if (`${name} ${lastname}`.trim()) {
      return `${name} ${lastname}`.trim();
    }

    const fallbackName = this.translate.instant('STEP1.FORM-INPUTS.InputName');
    const fallbackLastname = this.translate.instant('STEP1.FORM-INPUTS.InputLastName');
    return `${fallbackName} ${fallbackLastname}`;
  }

  get correoElectronico(): string {
    return this.paso1Value.email || this.translate.instant('STEP3.NotSpecified');
  }

  get telefono(): string {
    return this.paso1Value.phone || this.translate.instant('STEP3.NotSpecified');
  }

  get fechaNacimiento(): string {
    const birth = this.paso1Value.age;
    if (!birth) return this.translate.instant('STEP3.NotSpecified');
    const parts = birth.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return birth;
  }

  get edad(): string {
    const birth = this.paso1Value.age;
    if (!birth) return this.translate.instant('STEP3.NotSpecified');
    const birthDate = new Date(birth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} ${this.translate.instant('STEP3.YearsLabel')}`;
  }

  get genero(): string {
    const g = this.paso1Value.gender;
    if (!g) return this.translate.instant('STEP3.NotSpecified');
    if (g.toLowerCase() === 'masc') return this.translate.instant('STEP3.Male');
    if (g.toLowerCase() === 'fem') return this.translate.instant('STEP3.Female');
    return g;
  }

  get estado(): string {
    return this.formService.getSelectednames().stateName
  }

  get ciudad(): string {
    return this.paso1Value.city || this.translate.instant('STEP3.NotSpecified');
  }

  get iglesia(): string {
    return this.paso1Value.church || this.translate.instant('STEP3.NotSpecified');
  }

  get tallaCamiseta(): string {
    return this.formService.getSelectednames().sizeName
  }

  get esChaperon(): string {
    const chap = this.paso1Value.isChaperone;
    if (chap === undefined || chap === null || chap === '') return this.translate.instant('STEP3.NotSpecified');
    return chap === true || chap === 'true'
      ? this.translate.instant('STEP1.FORM-CHECKS.OPTIONS.OptionYes')
      : this.translate.instant('STEP1.FORM-CHECKS.OPTIONS.OptionNo');
  }

  // Emergency contact fields
  get nombreContacto(): string {
    return this.paso2Value.nameContact || this.translate.instant('STEP3.NotSpecified');
  }

  get telefonoContacto(): string {
    return this.paso2Value.phoneContact || this.translate.instant('STEP3.NotSpecified');
  }

  get relacionContacto(): string {
    const rel = this.paso2Value.relationship.value || this.paso2Value.relationship || '';
    if (!rel) return this.translate.instant('STEP3.NotSpecified');

    const relationships: { [key: string]: string } = {
      'esposo': this.translate.instant('STEP2.FORM-INPUTS.Options.Option1'),
      'padres': this.translate.instant('STEP2.FORM-INPUTS.Options.Option2'),
      'hermano': this.translate.instant('STEP2.FORM-INPUTS.Options.Option3'),
      'familia': this.translate.instant('STEP2.FORM-INPUTS.Options.Option4'),
      'amigo': this.translate.instant('STEP2.FORM-INPUTS.Options.Option5'),
      'otro': this.translate.instant('STEP2.FORM-INPUTS.Options.Option6')
    };
    return relationships[rel.toLowerCase()] || rel;
  }

  editarDatosPersonales(): void {
    this.router.navigate(['/registro', this.eventId, 'datos-personales']);
  }
}
