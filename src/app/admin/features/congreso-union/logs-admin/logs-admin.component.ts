import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminLog, LogAccion } from '../../../core/models/log.model';
import { LogsService } from '../../../core/services/logs.service';
import { EventsService } from '../../../core/services/events.service';
import { ApiResponse } from '../../../../core/models/api-response.interface';


@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-logs-admin',
  templateUrl: './logs-admin.component.html',
  styleUrls: ['./logs-admin.component.scss']
})
export class LogsAdminComponent implements OnInit {

  logs: AdminLog[] = [];

  private readonly avatarPalette: string[] = [
    '#F2994A', '#2D9CDB', '#9B51E0', '#EB5757', '#F2C94C',
    '#27AE60', '#5B6FE0', '#EE6C9B', '#56C2C0', '#BB6BD9'
  ];

  private readonly mesesCortos = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  // ---------- estado de carga ----------
  cargando = true;
  skeletonRows = Array.from({ length: 5 });

  // ---------- filtros ----------
  busqueda = '';

  // ---------- paginación ----------
  paginaActual = 1;
  porPagina = 10;
  opcionesPorPagina = [5, 10, 20, 50, 100];

  private readonly eventsService = inject(EventsService)

  constructor(private logsService: LogsService) { }

  ngOnInit(): void {
    this.getLogs();
  }

  getLogs(): void {

    this.cargando = true;
    this.eventsService.getLogs().subscribe({
      next: (response: ApiResponse<AdminLog[]>) => {
        this.logs = response.data
      },
      error: (error: HttpErrorResponse) => {
        this.cargando = false;
      },
      complete: () => {
        this.cargando = false;
      },
    })
  }

  // ---------- datos derivados (filtros + paginación) ----------
  get logsFiltrados(): AdminLog[] {
    const terminos = this.busqueda.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terminos.length === 0) return this.logs;
    return this.logs.filter(l => {
      const textoCompleto = `${l.adminName ?? ''} ${l.action ?? ''} ${l.afectedRegister ?? ''} ${l.details ?? ''}`.toLowerCase();
      return terminos.every(t => textoCompleto.includes(t));
    });
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.logsFiltrados.length / this.porPagina));
  }

  get logsPagina(): AdminLog[] {
    const inicio = (this.paginaActual - 1) * this.porPagina;
    return this.logsFiltrados.slice(inicio, inicio + this.porPagina);
  }

  get rangoPaginas(): (number | string)[] {
    const total = this.totalPaginas;
    const actual = this.paginaActual;
    const rango: (number | string)[] = [];
    for (let p = 1; p <= total; p++) {
      if (p === 1 || p === total || (p >= actual - 1 && p <= actual + 1)) {
        rango.push(p);
      } else if (rango[rango.length - 1] !== '...') {
        rango.push('...');
      }
    }
    return rango;
  }

  onBusquedaChange(): void { this.paginaActual = 1; }

  onPorPaginaChange(): void {
    this.paginaActual = 1;
    this.skeletonRows = Array.from({ length: this.porPagina });
  }

  irAPagina(pagina: number | string): void {
    if (pagina === '...') return;
    const destino = Math.min(Math.max(Number(pagina), 1), this.totalPaginas);
    this.paginaActual = destino;
  }

  anterior(): void { this.irAPagina(this.paginaActual - 1); }
  siguiente(): void { this.irAPagina(this.paginaActual + 1); }

  // ---------- helpers visuales ----------
  colorAvatar(nombre: string): string {
    return this.avatarPalette[nombre.charCodeAt(0) % this.avatarPalette.length];
  }

  inicial(nombre: string): string {
    return nombre.charAt(0).toUpperCase();
  }

  /** Clase de badge según el tipo de acción */
  claseBadge(accion: LogAccion): string {
    switch (accion) {
      case 'UPDATE_REGISTER': return 'badge-log badge-log-warning';
      case 'DELETE_REGISTER': return 'badge-log badge-log-danger';
      case 'CHECK_IN': return 'badge-log badge-log-success';
      case 'CREATE_REGISTER': return 'badge-log badge-log-info';
      default: return 'badge-log';
    }
  }

  fechaCorta(fecha: string | null): string {
    if (!fecha) return '';
    const dateObj = new Date(fecha);
    if (isNaN(dateObj.getTime())) return fecha;

    const mes = this.mesesCortos[dateObj.getMonth()];
    const dia = dateObj.getDate();
    const anio = dateObj.getFullYear();

    return `${mes} ${dia}, ${anio}`;
  }

}
