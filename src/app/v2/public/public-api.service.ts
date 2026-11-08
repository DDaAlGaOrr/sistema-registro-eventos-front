import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiV2Service } from '../core/api.service';
import { Locale } from '../core/models';
import {
    ChurchOption, PaymentMethod, PublicEventListItem, PublicEventPage, PublicForm, PublicLocation,
    PublicRegistration, RegistrationResult,
} from './public.models';

/** Llamadas sin sesión a /api/v2/public (el cliente lo pone el interceptor). */
@Injectable({ providedIn: 'root' })
export class PublicApiService {
    private api = inject(ApiV2Service);

    events(): Observable<PublicEventListItem[]> {
        return this.api.get('/public/events');
    }

    eventPage(slug: string): Observable<PublicEventPage> {
        return this.api.get(`/public/events/${encodeURIComponent(slug)}`);
    }

    form(formId: number): Observable<PublicForm> {
        return this.api.get(`/public/forms/${formId}`);
    }

    locations(): Observable<PublicLocation[]> {
        return this.api.get('/public/locations');
    }

    /** Sugerencias de ciudad del estado (lista vacía = escribirla a mano). */
    cities(stateCode: string): Observable<{ cities: string[]; available: boolean }> {
        return this.api.get(`/public/states/${encodeURIComponent(stateCode)}/cities`);
    }

    churches(conferenceId: number): Observable<ChurchOption[]> {
        return this.api.get(`/public/conferences/${conferenceId}/churches`);
    }

    register(formId: number, body: {
        answers: Record<string, unknown>; locale: Locale; paymentMethod?: PaymentMethod; captchaToken?: string;
    }): Observable<RegistrationResult> {
        return this.api.post(`/public/forms/${formId}/registrations`, body);
    }

    registration(publicCode: string): Observable<PublicRegistration> {
        return this.api.get(`/public/registrations/${publicCode}`);
    }

    checkout(publicCode: string): Observable<{ checkoutUrl: string }> {
        return this.api.post(`/public/registrations/${publicCode}/checkout`);
    }
}
