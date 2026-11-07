import { Observable } from 'rxjs/internal/Observable';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiResponse } from './../models/api-response.interface';
import { Conferences, States, Sizes } from '../models/general.interface';
import { URL_API, CITIES_API } from '../../environment/environment';
import { EventData } from '../models/event.interface';
import { UserDataRegister } from '../models/registration-to-save.interface';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private readonly httpClient = inject(HttpClient)

    public getStates(): Observable<ApiResponse<States[]>> {
        return this.httpClient.get<ApiResponse<States[]>>(`${URL_API}/conference/states`)
    }

    public getConferences(stateId: number): Observable<ApiResponse<Conferences[]>> {
        return this.httpClient.get<ApiResponse<Conferences[]>>(`${URL_API}/state/${stateId}/conferences`)
    }

    public getSizes(): Observable<ApiResponse<Sizes[]>> {
        return this.httpClient.get<ApiResponse<Sizes[]>>(`${URL_API}/shirt-sizes`)
    }

    public getCities(state: string): Observable<ApiResponse<string[]>> {
        return this.httpClient.post<ApiResponse<string[]>>(`${CITIES_API}/countries/state/cities`, {
            country: "United States",
            state: state
        })
    }

    public getEvent(eventId: number) {
        return this.httpClient.get<ApiResponse<EventData>>(`${URL_API}/events/${eventId}`)
    }

    public saveRegister(body: UserDataRegister, eventId: string | null): Observable<ApiResponse<number>> {
        return this.httpClient.post<ApiResponse<number>>(`${URL_API}/events/${eventId}/register`, body)
    }

    public wasFoodPaid(registerId: number): Observable<ApiResponse<boolean>> {
        return this.httpClient.get<ApiResponse<boolean>>(`${URL_API}/events/register/${registerId}/was-food-paid`)
    }
}