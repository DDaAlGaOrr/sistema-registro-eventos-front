import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReactiveFormsModule, FormGroup, Validators } from '@angular/forms';
import { RegistrationFormService } from '../../../../core/services/registration-form.service';
import { ApiResponse } from '../../../../core/models/api-response.interface';
import { ApiService } from './../../../../core/services/api.service';
import { Conferences, Sizes, States } from '../../../../core/models/general.interface';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { EventsService } from '../../../../admin/core/services/events.service';
import { Churches } from '../../../../admin/core/models/dashboard.model';

@Component({
  selector: 'app-step1-datos-personales',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './step1-datos-personales.component.html',
  styleUrl: './step1-datos-personales.component.scss',
})
export class Step1DatosPersonalesComponent implements OnInit {
  paso1Form!: FormGroup;

  states = signal<States[]>([]);
  conferences = signal<Conferences[]>([]);
  cities = signal<string[]>([]);
  sizes = signal<Sizes[]>([]);
  availableChurches: String[] = []

  constructor(
    private registrationFormService: RegistrationFormService,
    private apiService: ApiService,
    private eventsService: EventsService,
  ) { }

  ngOnInit() {
    this.paso1Form = this.registrationFormService.stepperForm.get(
      'paso1',
    ) as FormGroup;
    this.getStates();
    this.getSizes();
    this.addStateEvent();
    this.addSizeEvent();
    this.addConferenceEvent()
    this.getChurches()

    this.paso1Form.get('includesTshirt')?.valueChanges.subscribe((value) => {
      this.updateSizeShirtValidation(value);
    });
    this.updateSizeShirtValidation(this.paso1Form.get('includesTshirt')?.value);

    this.paso1Form.get('includesLunch')?.valueChanges.subscribe((value) => {
      this.updateFoodPreferenceValidation(value);
    });
    this.updateFoodPreferenceValidation(
      this.paso1Form.get('includesLunch')?.value,
    );

    this.paso1Form.get('foodPreference')?.valueChanges.subscribe((value) => {
      this.updateFoodPreferenceDetailsValidation(value);
    });
    this.updateFoodPreferenceDetailsValidation(
      this.paso1Form.get('foodPreference')?.value,
    );
  }


  getChurches() {
    this.eventsService.getChurches().subscribe({
      next: (response: ApiResponse<Churches[]>) => {
        this.availableChurches = response.data.map(church => church.iglesia)
      },
      error: (error: HttpErrorResponse) => {
      },
      complete: () => {
      },
    })
  }

  private updateSizeShirtValidation(value: boolean | null) {
    const sizeControl = this.paso1Form.get('sizeShirt');
    if (value === true) {
      sizeControl?.setValidators([Validators.required]);
    } else {
      sizeControl?.clearValidators();
      sizeControl?.setValue(null);
    }
    sizeControl?.updateValueAndValidity();
  }

  private updateFoodPreferenceValidation(value: boolean | null) {
    const foodPrefControl = this.paso1Form.get('foodPreference');
    if (value === true) {
      foodPrefControl?.setValidators([Validators.required]);
    } else {
      foodPrefControl?.clearValidators();
      foodPrefControl?.setValue(null);
    }
    foodPrefControl?.updateValueAndValidity();
  }

  private updateFoodPreferenceDetailsValidation(value: string | null) {
    const detailsControl = this.paso1Form.get('foodPreferenceDetails');
    if (value === 'otra') {
      detailsControl?.setValidators([Validators.required]);
    } else {
      detailsControl?.clearValidators();
      detailsControl?.setValue(null);
    }
    detailsControl?.updateValueAndValidity();
  }

  addStateEvent() {
    this.paso1Form.get('state')?.valueChanges.subscribe((stateId) => {
      this.paso1Form.get('city')?.setValue('');
      this.loadConferencesAndCities(stateId);
    });
  }

  addConferenceEvent() {
    this.paso1Form.get('conference')?.valueChanges.subscribe((conferenceId) => {
      const selectedConference = this.conferences().find((conference: Conferences) => conference.id == conferenceId)
      if (selectedConference) this.registrationFormService.setSelectedConferenceName(selectedConference.nombre)
    });
  }

  loadConferencesAndCities(stateId: string | number) {
    if (!stateId) return;

    const parsedId = typeof stateId === 'string' ? parseInt(stateId) : stateId;

    const state = this.states().find((s) => s.id === parsedId);

    if (state != undefined) {
      this.registrationFormService.setSelectedStateName(state.nombre);

      this.apiService.getCities(state.nombre).subscribe({
        next: (response: ApiResponse<string[]>) => {
          this.cities.set(response.data);
        },
        error: (error: HttpErrorResponse) => { },
      });
    }

    this.apiService.getConferences(parsedId).subscribe({
      next: (response: ApiResponse<Conferences[]>) => {
        this.conferences.set(response.data);
      },
      error: (error: HttpErrorResponse) => { },
    });
  }

  addSizeEvent() {
    this.paso1Form.get('sizeShirt')?.valueChanges.subscribe((sizeId) => {
      if (sizeId) {
        const size = this.sizes().find((s) => s.id === parseInt(sizeId));
        if (size != undefined) {
          this.registrationFormService.setSizeName(size.talla);
        }
      }
    });
  }

  getSizes() {
    this.apiService.getSizes().subscribe({
      next: (response: ApiResponse<Sizes[]>) => {
        this.sizes.set(response.data);
        this.checkInitialSize();
      },
      error: (error: HttpErrorResponse) => { },
    });
  }

  checkInitialSize() {
    const sizeId = this.paso1Form.get('sizeShirt')?.value;
    if (sizeId) {
      const size = this.sizes().find((s) => s.id === parseInt(sizeId));
      if (size != undefined) {
        this.registrationFormService.setSizeName(size.talla);
      }
    }
  }
  getStates() {
    this.apiService.getStates().subscribe({
      next: (response: ApiResponse<States[]>) => {
        this.states.set(response.data);

        const currentStateId = this.paso1Form.get('state')?.value;
        if (currentStateId) {
          this.loadConferencesAndCities(currentStateId);
        }
      },
      error: (error: HttpErrorResponse) => { },
    });
  }
}
