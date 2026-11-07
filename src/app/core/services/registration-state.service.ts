import { Injectable, signal } from '@angular/core';
import { RegistrationData } from '../models/registration.interface';

@Injectable({
  providedIn: 'root'
})
export class RegistrationStateService {
  // Estado global del registro
  readonly formData = signal<RegistrationData | null>(null);

  // Control del paso actual para pintar el Stepper
  readonly currentStep = signal<number>(0);

  updateFormData(data: Partial<RegistrationData>) {
    this.formData.update(current => ({ ...current, ...data } as RegistrationData));
  }

  setStep(step: number) {
    this.currentStep.set(step);
  }

}
