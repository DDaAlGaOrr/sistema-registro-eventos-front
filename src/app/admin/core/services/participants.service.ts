import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { NuevoParticipante, Participante } from './../models/participants.model';
import { RegisteredUsers } from '../models/events.model';

@Injectable({ providedIn: 'root' })
export class ParticipantesService {

  private readonly jsonUrl = 'assets/data/registered.json';

  private readonly participantesSubject =
    new BehaviorSubject<RegisteredUsers[]>([]);

  private cargado = false;

  constructor(private http: HttpClient) {}

  getParticipantes(): Observable<RegisteredUsers[]> {

    if (!this.cargado) {

      this.cargado = true;

      this.http.get<RegisteredUsers[]>(this.jsonUrl).pipe(
        tap(data => this.participantesSubject.next(data))
      ).subscribe({
        error: () => {
          this.cargado = false;
        }
      });

    }

    return this.participantesSubject.asObservable();
  }

  actualizarParticipante(participante: RegisteredUsers): void {

    const actualizados =
      this.participantesSubject.value.map(p =>
        p.id === participante.id
          ? { ...participante }
          : p
      );

    this.participantesSubject.next(actualizados);
  }

  eliminarParticipante(id: number): void {

    const filtrados =
      this.participantesSubject.value.filter(
        p => p.id !== id
      );

    this.participantesSubject.next(filtrados);
  }
}
