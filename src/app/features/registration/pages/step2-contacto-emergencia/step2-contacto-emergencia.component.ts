import { Component, OnInit } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RegistrationFormService } from '../../../../core/services/registration-form.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-step2-contacto-emergencia',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './step2-contacto-emergencia.component.html',
  styleUrl: './step2-contacto-emergencia.component.scss',
})
export class Step2ContactoEmergenciaComponent implements OnInit {
  paso2Form!: FormGroup;

  constructor(private registrationFormService: RegistrationFormService) {}

  ngOnInit() {
    this.paso2Form = this.registrationFormService.stepperForm.get(
      'paso2',
    ) as FormGroup;
  }
}
