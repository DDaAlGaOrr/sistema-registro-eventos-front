import { Injectable, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class RegistrationFormService {
  public stepperForm: FormGroup;
  public selectedStateName = signal<string>('')
  public selectedSizeName = signal<string>('')
  public selectedConferenceName = signal<string>('')

  constructor(private fb: FormBuilder) {
    this.stepperForm = this.fb.group({
      paso1: this.fb.group({
        name: ['', Validators.required],
        lastname: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(12)]],
        age: ['', Validators.required],
        gender: ['', Validators.required],
        state: ['', Validators.required],
        conference: ['', Validators.required],
        city: ['', Validators.required],
        church: ['', Validators.required],
        sizeShirt: ['', null],
        includesLunch: ['', null],
        foodPreference: [null],
        foodPreferenceDetails: [null],
        includesTshirt: ['', null],
        isChaperone: ['', Validators.required]
      }),
      paso2: this.fb.group({
        nameContact: ['', Validators.required],
        phoneContact: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(12)]],
        relationship: ['', Validators.required]
      }),
      paso3: this.fb.group({
        comentarios: ['']
      }),
      paso4: this.fb.group({}),
      paso5: this.fb.group({})
    });
  }

  setSelectedStateName(name: string) {
    this.selectedStateName.set(name)
  }

  setSelectedConferenceName(name: string) {
    this.selectedConferenceName.set(name)
  }

  setSizeName(name: string) {
    this.selectedSizeName.set(name)
  }

  setEmptySelectedNames() {
    this.selectedStateName.set('')
    this.selectedSizeName.set('')
  }

  getSelectednames(): { stateName: string, sizeName: string, conferenceName: string } {
    return {
      "stateName": this.selectedStateName(),
      "sizeName": this.selectedSizeName(),
      "conferenceName": this.selectedConferenceName()
    }
  }
}
