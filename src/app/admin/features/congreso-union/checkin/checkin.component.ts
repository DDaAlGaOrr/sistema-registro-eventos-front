import { Component, OnDestroy, OnInit, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  Conferencia,
  ESTADOS_PAGO_DISPONIBLES,
  EstadoPago,
  Estado,
  Participante,
  TALLAS_DISPONIBLES,
  TallaCamiseta,
} from '../../../core/models/participants.model';
import { ParticipantesService } from '../../../core/services/participants.service';
import { RegisteredUsers } from '../../../core/models/events.model';
import { EventsService } from '../../../core/services/events.service';
import { ApiResponse } from '../../../../core/models/api-response.interface';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { Conferences, Sizes, States } from '../../../../core/models/general.interface';
import { AuthService } from '../../../auth/auth/service/auth.service';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

// El bundle JS de Bootstrap se carga globalmente (angular.json > scripts),
// por eso se declara así en lugar de importarlo como módulo de Angular.
declare var bootstrap: any;
interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'superadmin' | 'finanzas' | 'staff' | 'admin' | 'vicePresident';
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ZXingScannerModule],
  selector: 'app-checkin',
  templateUrl: './checkin.component.html',
  styleUrls: ['./checkin.component.scss']
})
export class CheckinComponent implements OnInit, OnDestroy, AfterViewInit {

  participantes: RegisteredUsers[] = [];

  tallasDisponibles: TallaCamiseta[] = TALLAS_DISPONIBLES;
  estadosPagoDisponibles: EstadoPago[] = ESTADOS_PAGO_DISPONIBLES;

  private readonly avatarPalette: string[] = [
    '#F2994A', '#2D9CDB', '#9B51E0', '#EB5757', '#F2C94C',
    '#27AE60', '#5B6FE0', '#EE6C9B', '#56C2C0', '#BB6BD9'
  ];

  // ---------- estado de carga ----------
  cargando = true;
  skeletonRows = Array.from({ length: 5 });

  // ---------- búsqueda ----------
  busqueda = '';
  states = signal<States[]>([]);
  conferences = signal<Conferences[]>([]);
  cities = signal<string[]>([]);
  sizes = signal<Sizes[]>([]);
  // ---------- paginación ----------
  paginaActual = 1;
  porPagina = 5;
  opcionesPorPagina = [5, 10, 20, 50, 100];

  // ---------- formulario del modal ----------
  form: FormGroup;
  editandoId: number | null = null;
  /** Participante completo que se está editando, para no perder campos que este formulario no expone (teléfono) */
  private participanteOriginal: RegisteredUsers | null = null;
  participanteAEliminar: RegisteredUsers | null = null;
  eventId: string | null = null;

  private editModal: any;
  private deleteModal: any;
  private suscripcion?: Subscription;
  authUser: AuthUser = {} as AuthUser
  private readonly route = inject(ActivatedRoute)
  private readonly apiService = inject(ApiService)
  private readonly authService = inject(AuthService)

  public showScanner: boolean = false;
  public IdFromScanner: number = -1;
  public wasFoodPaid: boolean = false;

  constructor(
    private participantesService: ParticipantesService,
    private fb: FormBuilder,
    private eventsService: EventsService
  ) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      apellidos: ['', Validators.required],
      registro: ['', Validators.required],
      estado_id: ['', Validators.required],
      conferencia_id: ['', Validators.required],
      ciudad: ['', Validators.required],
      tipo_alimento: ['', Validators.required],
      pago_camiseta: ['Pendiente', Validators.required],
      talla_camiseta_id: ['MD', Validators.required],
      pago_lunchtime: ['Pendiente', Validators.required],
      checkin_at: [false],
    });
  }


  ngOnInit(): void {
    this.route.parent?.paramMap.subscribe(params => {
      this.eventId = params.get('id');
      this.getRegisteredUsers(this.eventId)
    });
    this.addStateEvent()
    this.authUser = this.authService.getUser() as AuthUser;
  }

  addStateEvent() {
    this.form.get('estado_id')?.valueChanges.subscribe((stateId) => {
      this.form.get('ciudad')?.setValue('')
      this.loadConferencesAndCities(stateId);
    });
  }

  getStates() {
    this.apiService.getStates().subscribe({
      next: (response: ApiResponse<States[]>) => {
        this.states.set(response.data);
        const currentStateId = this.form.get('estado_id')?.value;
        if (currentStateId) {
          this.loadConferencesAndCities(currentStateId);
        }
      },
      error: (error: HttpErrorResponse) => { },
    });
  }

  getSizes() {
    this.apiService.getSizes().subscribe({
      next: (response: ApiResponse<Sizes[]>) => {
        this.sizes.set(response.data);
      },
      error: (error: HttpErrorResponse) => { },
    });
  }

  loadConferencesAndCities(stateId: string | number) {
    if (!stateId) return;

    const parsedId = typeof stateId === 'string' ? parseInt(stateId) : stateId;

    const state = this.states().find(s => s.id === parsedId);
    if (state != undefined) {

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


  ngAfterViewInit(): void {
    const editEl = document.getElementById('checkinEditModal');
    const deleteEl = document.getElementById('checkinDeleteModal');

    if (editEl) this.editModal = new bootstrap.Modal(editEl);
    if (deleteEl) this.deleteModal = new bootstrap.Modal(deleteEl);
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
    this.editModal?.dispose();
    this.deleteModal?.dispose();
  }

  getRegisteredUsers(eventId: any) {
    this.cargando = true;
    this.eventsService.getRegisteredUsers(eventId).subscribe({
      next: (response: ApiResponse<RegisteredUsers[]>) => {
        this.participantes = response.data
      },
      error: (error: HttpErrorResponse) => {
        this.cargando = false;
      },
      complete: () => {
        this.cargando = false;
      },
    })
  }
  cerrarModalEditar(): void {
    this.editModal?.hide();
  }

  cerrarModalEliminar(): void {
    this.deleteModal?.hide();
    this.participanteAEliminar = null; // Buena práctica limpiar el estado
  }
  // ---------- datos derivados (búsqueda + paginación) ----------
  get participantesFiltrados(): RegisteredUsers[] {
    const terminos = this.busqueda.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return this.participantes.filter(p => {
      const textoCompleto = `${p.nombre ?? ''} ${p.apellidos ?? ''} ${p.telefono ?? ''} ${p.correo ?? ''}`.toLowerCase();
      const coincideBusqueda = terminos.length === 0 || terminos.every(t => textoCompleto.includes(t));
      return coincideBusqueda;
    });
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.participantesFiltrados.length / this.porPagina));
  }

  get participantesPagina(): RegisteredUsers[] {
    const inicio = (this.paginaActual - 1) * this.porPagina;
    return this.participantesFiltrados.slice(inicio, inicio + this.porPagina);
  }

  /** Rango de botones de paginación, con '...' donde se colapsan páginas intermedias */
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

  // ---------- check-in directo desde la tabla ----------
  toggleCheckin(p: RegisteredUsers): void {
    this.eventsService.checkInUser(p.id).subscribe({
      next: (response: ApiResponse<any>) => {
        this.getRegisteredUsers(this.eventId)
      },
      error: (error: HttpErrorResponse) => {
      },
      complete: () => {
      },
    })

  }

  // ---------- modal editar ----------
  abrirModalEditar(p: RegisteredUsers): void {
    this.editandoId = p.id;
    this.participanteOriginal = p;
    this.form.setValue({
      nombre: p.nombre,
      apellidos: p.apellidos,
      registro: this.ddmmyyyyAIso(p.created_at),
      estado_id: p.estado_id,
      conferencia_id: p.conferencia_id,
      ciudad: p.ciudad,
      tipo_alimento: p.tipo_alimento,
      pago_camiseta: p.pago_camiseta,
      talla_camiseta_id: p.talla_camiseta_id ? p.talla_camiseta_id : 7,
      pago_lunchtime: p.pago_lunchtime,
      checkin_at: p.checkin_at != null,
    });
    if (this.authUser.role === "finanzas") {
      this.form.get("nombre")?.disable()
      this.form.get("apellidos")?.disable()
      this.form.get("registro")?.disable()
      this.form.get("estado_id")?.disable()
      this.form.get("conferencia_id")?.disable()
      this.form.get("ciudad")?.disable()
      this.form.get("checkin_at")?.disable()
    }
    this.editModal?.show();
    this.getStates()
    this.getSizes()
  }


  guardar(): void {
    if (this.form.invalid || !this.participanteOriginal) {
      this.form.markAllAsTouched();
      return;
    }
    const payloadActualizado: any = {};
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);

      if (control && control.dirty) {
        payloadActualizado[key] = control.value;
      }
    });

    if (Object.keys(payloadActualizado).length === 0) {
      this.editModal?.hide();
      return;
    }
    this.eventsService.updateRegister(payloadActualizado, this.participanteOriginal.id).subscribe({
      next: (response: ApiResponse<any>) => {
        this.getRegisteredUsers(this.eventId)
      },
      error: (error: HttpErrorResponse) => {
      },
      complete: () => {
      },
    })

    this.editModal?.hide();
  }

  // ---------- modal eliminar ----------
  abrirModalEliminar(p: RegisteredUsers): void {
    this.participanteAEliminar = p;
    this.deleteModal?.show();
  }

  confirmarEliminar(): void {
    if (this.participanteAEliminar) {
      this.eventsService.removeRegister(this.participanteAEliminar.id).subscribe({
        next: (response: ApiResponse<RegisteredUsers[]>) => {
          this.getRegisteredUsers(this.eventId)
        },
        error: (error: HttpErrorResponse) => {
        },
        complete: () => {
        },
      })
      this.participanteAEliminar = null;
    }
    this.deleteModal?.hide();
  }

  private ddmmyyyyAIso(fecha: string): string {
    if (!fecha) return '';

    if (fecha.includes('T')) {
      return fecha.split('T')[0];
    }

    const dateObj = new Date(fecha);
    if (isNaN(dateObj.getTime())) return '';

    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');

    return `${y}-${m}-${d}`;
  }

  public isoADdmmyyyy(fecha: string | null): string {
    if (!fecha) return '';

    const dateObj = new Date(fecha);

    if (isNaN(dateObj.getTime())) return fecha;

    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();

    let resultado = `${d}/${m}/${y}`;

    if (fecha.includes('T')) {
      let horas = dateObj.getHours();
      const minutos = String(dateObj.getMinutes()).padStart(2, '0');
      const ampm = horas >= 12 ? 'PM' : 'AM';

      horas = horas % 12;
      horas = horas ? horas : 12;

      const horasStr = String(horas).padStart(2, '0');

      resultado += ` ${horasStr}:${minutos} ${ampm}`;
    }

    return resultado;
  }

  openQRScanner() {
    this.showScanner = true
    this.IdFromScanner = -1
  }

  closeScanner() {
    this.showScanner = false;
  }
  onCodeResult(resultString: string) {
    const parsedId = parseInt(resultString, 10);
    if (isNaN(parsedId)) {
      console.error('El código QR escaneado no es un ID válido:', resultString);
      return;
    }
    this.IdFromScanner = parsedId;
    this.apiService.wasFoodPaid(this.IdFromScanner).subscribe({
      next: (response: ApiResponse<boolean>) => {
        this.wasFoodPaid = response.data
      },
      error: (error: HttpErrorResponse) => {
      },
      complete: () => {
      },

    })
  }
}
