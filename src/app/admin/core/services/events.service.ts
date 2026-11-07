import { Injectable } from '@angular/core';
import { ApiResponse } from '../../../core/models/api-response.interface';
import { RegisteredUsers } from '../models/events.model';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { URL_API } from '../../../environment/environment';
import { Churches, RecentActivity, StatCard } from '../models/dashboard.model';
import { AdminLog } from '../models/log.model';

@Injectable({
  providedIn: 'root'
})
export class EventsService {

  constructor(private httpClient: HttpClient) { }

  public getRegisteredUsers(eventId: number): Observable<ApiResponse<RegisteredUsers[]>> {
    return this.httpClient.get<ApiResponse<RegisteredUsers[]>>(`${URL_API}/events/${eventId || 2}/registrations`)
  }

  public checkInUser(userId: number): Observable<ApiResponse<any>> {
    return this.httpClient.get<ApiResponse<any>>(`${URL_API}/events/register/${userId}/checkin`)
  }

  public removeRegister(registerId: number): Observable<ApiResponse<any>> {
    return this.httpClient.delete<ApiResponse<any>>(`${URL_API}/events/register/${registerId}/delete`)
  }

  public updateRegister(data: any, registerId: number): Observable<ApiResponse<any>> {
    return this.httpClient.put<ApiResponse<any>>(`${URL_API}/events/register/${registerId}/update`, data)
  }

  public getResumen(eventId: number): Observable<ApiResponse<StatCard[]>> {
    return this.httpClient.get<ApiResponse<StatCard[]>>(`${URL_API}/resumen/event/${eventId}`)
  }

  public getRecentActivities(eventId: number): Observable<ApiResponse<RecentActivity[]>> {
    return this.httpClient.get<ApiResponse<RecentActivity[]>>(`${URL_API}/events/recent-activity/${eventId}`)
  }

  public getLogs(): Observable<ApiResponse<AdminLog[]>> {
    return this.httpClient.get<ApiResponse<AdminLog[]>>(`${URL_API}/logs`)
  }

  public getChurches(): Observable<ApiResponse<Churches[]>> {
    return this.httpClient.get<ApiResponse<Churches[]>>(`${URL_API}/churches`)
  }


  public normalizarIglesia(nombreCrudo: string): string {
    if (!nombreCrudo) return 'Desconocida';

    const nombre = nombreCrudo.toLowerCase().trim();

    if (nombre.includes('maranatha') || nombre.includes('maranata') || nombre.includes('marantha')) {
      if (nombre.includes('las vegas')) return 'Maranatha Las Vegas';
      if (nombre.includes('san josé') || nombre.includes('san jose')) return 'San José Maranatha';
      return 'Maranatha SDA';
    }

    if (nombre.includes('central valley') || nombre.includes('central bali')) return 'Phoenix Central Valley';
    if (nombre.includes('north valley') || nombre.includes('nort valley') || nombre.includes('norvali')) return 'North Valley Spanish';
    if (nombre.includes('san diego central') || nombre.includes('san diego cental')) return 'San Diego Central';
    if (nombre.includes('san diego spanish') || nombre.includes('san diego eta')) return 'San Diego Spanish';
    if (nombre.includes('san bernardino')) return 'San Bernardino Spanish';
    if (nombre.includes('phoenix spanish central') || nombre.includes('central spanish') || nombre.includes('central hispana') || nombre.includes('phoenix central spanish')) return 'Phoenix Central Spanish';
    if (nombre.includes('shalom') || nombre.includes('sholom')) return 'Shalom SDA';
    if (nombre.includes('avondale')) return 'Avondale Spanish';
    if (nombre.includes('mesa')) return 'Mesa Hispanic';
    if (nombre.includes('peoria')) return 'Peoria Spanish';
    if (nombre.includes('west valley')) return 'West Valley';
    if (nombre.includes('san luis')) return 'San Luis AZ';
    if (nombre.includes('paradise') || nombre.includes('paraiso')) return 'Paradise SDA';
    if (nombre.includes('faro')) return 'Faro del Este';
    if (nombre.includes('napa')) return 'Napa Valley';
    if (nombre.includes('mountain view')) return 'Mountain View Hispana';
    if (nombre.includes('fil am') || nombre.includes('fil-am')) return 'Living Water Fil-Am';

    let nombreFormateado = nombre.split(' ').map(palabra => {
      if (palabra.length === 0) return '';
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    }).join(' ');

    nombreFormateado = nombreFormateado.replace(/\bsda\b/ig, 'SDA');
    nombreFormateado = nombreFormateado.replace(/\bDel\b/g, 'del').replace(/\bDe\b/g, 'de').replace(/\bA\b/g, 'a');

    return nombreFormateado;
  }
}
