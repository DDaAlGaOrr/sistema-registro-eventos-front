import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
// Importamos tus interfaces
import { DashboardData, StatCard, RecentActivity, StaffMember, WeeklyRegistrationsData, GenderByMonthData, TshirtSizesData } from '../models/dashboard.model';
import { ApiResponse } from '../../../core/models/api-response.interface';
import { URL_API } from '../../../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);

  // La ruta hacia tu archivo local en assets
  private jsonUrl = 'assets/data/dashboard.json';

  // Opción A: Traer todo el objeto JSON junto
  getDashboardData(): Observable<DashboardData> {
    return this.http.get<DashboardData>(this.jsonUrl);
  }

  // Opción B: Traer solo las estadísticas filtrando el JSON
  getStats(): Observable<StatCard[]> {
    return this.http.get<DashboardData>(this.jsonUrl).pipe(
      map(response => response.stats)
    );
  }

  // Opción C: Traer solo las actividades recientes filtrando el JSON
  getRecentActivities(): Observable<RecentActivity[]> {
    return this.http.get<DashboardData>(this.jsonUrl).pipe(
      map(response => response.activities)
    );
  }

  // Opción D: Traer solo el staff filtrando el JSON
  getStaffMembers(): Observable<StaffMember[]> {
    return this.http.get<DashboardData>(this.jsonUrl).pipe(
      map(response => response.staff)
    );
  }

  public getWeeklyRegistrations(eventId: number): Observable<ApiResponse<WeeklyRegistrationsData>> {
    return this.http.get<ApiResponse<WeeklyRegistrationsData>>(`${URL_API}/weekly-registrations/event/${eventId}`)
  }
  public getGenderByMonth(eventId: number): Observable<ApiResponse<GenderByMonthData>> {
    return this.http.get<ApiResponse<GenderByMonthData>>(`${URL_API}/gender-by-month/event/${eventId}`)
  }
  public getTshirtSizes(eventId: number): Observable<ApiResponse<TshirtSizesData>> {
    return this.http.get<ApiResponse<TshirtSizesData>>(`${URL_API}/tshirt-sizes/event/${eventId}`)
  }
}
