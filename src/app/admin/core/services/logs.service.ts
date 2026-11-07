import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminLog } from '../models/log.model';

@Injectable({ providedIn: 'root' })
export class LogsService {
  private readonly jsonUrl = 'assets/data/logs.json';

  constructor(private http: HttpClient) {}

  getLogs(): Observable<AdminLog[]> {
    return this.http.get<AdminLog[]>(this.jsonUrl);
  }
}
