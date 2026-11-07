import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistrationFormService } from '../../../../core/services/registration-form.service';
import { Router } from '@angular/router';
import { EmergencyData, UserDataRegister } from '../../../../core/models/registration-to-save.interface';
import { ActivatedRoute } from '@angular/router';
import { ApiResponse } from '../../../../core/models/api-response.interface';
import { ApiService } from './../../../../core/services/api.service';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-step4-confirmacion',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './step4-confirmacion.component.html',
  styleUrl: './step4-confirmacion.component.scss'
})
export class Step4ConfirmacionComponent {
  private formService = inject(RegistrationFormService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private translate = inject(TranslateService);
  isSaving: boolean = false
  eventId: string | null = null;

  ngOnInit() {
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
    return `${name} ${lastname}`.trim() || this.translate.instant('STEP3.NotSpecified');
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
    const t = this.paso1Value.sizeShirt;
    if (!t) return this.translate.instant('STEP3.NotSpecified');
    const sizes: { [key: string]: string } = {
      's': this.translate.instant('STEP3.SizeSmall'),
      'm': this.translate.instant('STEP3.SizeMedium'),
      'l': this.translate.instant('STEP3.SizeLarge'),
      'xl': this.translate.instant('STEP3.SizeExtraLarge')
    };
    return sizes[t.toLowerCase()] || t;
  }

  get esChaperon(): string {
    const chap = this.paso1Value.isChaperone;
    if (chap === undefined || chap === null || chap === '') return this.translate.instant('STEP3.NotSpecified');
    return chap === true || chap === 'true'
      ? this.translate.instant('STEP1.FORM-CHECKS.OPTIONS.OptionYes')
      : this.translate.instant('STEP1.FORM-CHECKS.OPTIONS.OptionNo');
  }

  get nombreContacto(): string {
    return this.paso2Value.nameContact || this.translate.instant('STEP3.NotSpecified');
  }

  get telefonoContacto(): string {
    return this.paso2Value.phoneContact || this.translate.instant('STEP3.NotSpecified');
  }

  get relacionContacto(): string {
    const rel = this.paso2Value.relationship;
    if (!rel) return this.translate.instant('STEP3.NotSpecified');
    const relationships: { [key: string]: string } = {
      'familia': this.translate.instant('STEP2.FORM-CHECKS.Options.Option4'),
      'amigo': this.translate.instant('STEP2.FORM-CHECKS.Options.Option5'),
      'otro': this.translate.instant('STEP2.FORM-CHECKS.Options.Option6')
    };
    return relationships[rel.toLowerCase()] || rel;
  }

  regresar(): void {
    this.router.navigate(['/registro/resumen']);
  }

  finalizar(): void {

    if (this.isSaving) return;
    this.isSaving = true;
    const data: UserDataRegister = {
      conferencia_id: this.paso1Value.conference,
      nombre_conferencia: this.formService.getSelectednames().conferenceName,
      talla_camiseta_id: this.paso1Value.sizeShirt,
      nombre: this.paso1Value.name,
      apellidos: this.paso1Value.lastname,
      correo: this.paso1Value.email,
      telefono: this.paso1Value.phone,
      fecha_nacimiento: this.paso1Value.age,
      genero: this.paso1Value.gender,
      estado_id: this.paso1Value.state,
      nombre_estado: this.formService.getSelectednames().stateName,
      ciudad: this.paso1Value.city,
      iglesia: this.paso1Value.church,
      // incluir_lunchtime: this.paso1Value.includesLunch,
      incluir_lunchtime: false,
      es_chaperon: this.paso1Value.isChaperone,
      incluir_camisa: false,
      // incluir_camisa: this.paso1Value.includesTshirt,
      tipo_alimento: this.paso1Value.foodPreference,
      alimento_especial_nota: this.paso1Value.foodPreferenceDetails,
      contacto_emergencia: {
        nombre_contacto: this.paso2Value.nameContact,
        telefono_contacto: this.paso2Value.phoneContact,
        relacion: this.paso2Value.relationship
      }
    }


    this.apiService.saveRegister(data, this.eventId).subscribe({

      next: (response: ApiResponse<number>) => {
        if (response.data != null) {
          this.router.navigate(['/registro', this.eventId, 'recibido']);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        console.error('Error al guardar el registro', error);
      },
      complete: () => {
        this.isSaving = false;
      },
    });
  }
}
