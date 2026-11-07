import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Conferencia, Estado, ESTADOS_DISPONIBLES, Participante } from '../../../core/models/participants.model';
import { ApiResponse } from '../../../../core/models/api-response.interface';
import { States, Conferences, Sizes } from '../../../../core/models/general.interface';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../auth/auth/service/auth.service';
import { RegisteredUsers } from '../../../core/models/events.model';
import { TallaCamiseta, TALLAS_DISPONIBLES, EstadoPago, ESTADOS_PAGO_DISPONIBLES } from '../../../core/models/participants.model';
import { EventsService } from '../../../core/services/events.service';
import { ParticipantesService } from '../../../core/services/participants.service';
import { PdfProductsService } from '../../../core/services/pdf-products.service';
import { Churches } from '../../../core/models/dashboard.model';


declare var bootstrap: any;

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'superadmin' | 'finanzas' | 'staff' | 'admin' | 'vicePresident';
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  selector: 'app-productos',
  templateUrl: './productos.component.html',
  styleUrls: ['./productos.component.scss'],
})
export class ProductosComponent implements OnInit, OnDestroy {
  private PdfProductsService = inject(PdfProductsService);

  participantes: RegisteredUsers[] = [];

  conferenciasBase: string[] = [
    'Arizona Conference',
    'Central California Conference',
    'Hawaii Conference',
    'Nevada-Utah Conference',
    'Northern California Conference',
    'Southeastern California Conference',
    'Southern California Conference',
  ];
  opcionesTalla: string[] = [
    "XS",
    "S",
    "M",
    "L",
    "XL",
  ]
  opcionesProductos = [
    {
      "estatus": "Inluye comida",
      "valor": "comida"
    },
    {
      "estatus": "Incluye playera",
      "valor": 'playera'
    }
  ]
  estadosDisponibles: Estado[] = ESTADOS_DISPONIBLES;

  tallasDisponibles: TallaCamiseta[] = TALLAS_DISPONIBLES;
  estadosPagoDisponibles: EstadoPago[] = ESTADOS_PAGO_DISPONIBLES;

  private readonly avatarPalette: string[] = [
    '#F2994A',
    '#2D9CDB',
    '#9B51E0',
    '#EB5757',
    '#F2C94C',
    '#27AE60',
    '#5B6FE0',
    '#EE6C9B',
    '#56C2C0',
    '#BB6BD9',
  ];

  // ---------- estado de carga ----------
  cargando = true;
  skeletonRows = Array.from({ length: 5 });

  // ---------- búsqueda ----------
  busqueda = '';
  filtroEstado = '';
  filtroConferencia = '';
  filtroProductos = '';
  filtroTalla = '';
  filtroIglesia: string = '';
  sizes = signal<Sizes[]>([]);

  // ---------- paginación ----------
  paginaActual = 1;
  porPagina = 5;
  opcionesPorPagina = [5, 10, 20, 50, 100];
  churchesMasterList: Churches[] = [];

  // ---------- formulario del modal ----------
  form: FormGroup;
  editandoId: number | null = null;
  /** Participante completo que se está editando, para no perder campos que este formulario no expone (teléfono) */
  private participanteOriginal: RegisteredUsers | null = null;
  participanteAEliminar: RegisteredUsers | null = null;
  eventId: string | null = null;

  private editModal: any;
  private suscripcion?: Subscription;
  authUser: AuthUser = {} as AuthUser;
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(ApiService);
  private readonly authService = inject(AuthService);

  public showScanner: boolean = false;
  public IdFromScanner: number = -1;
  public wasFoodPaid: boolean = false;

  constructor(
    private participantesService: ParticipantesService,
    private fb: FormBuilder,
    private eventsService: EventsService,
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
      sx_id: ['MD', Validators.required],
      pago_lunchtime: ['Pendiente', Validators.required],
      checkin_at: [false],
    });
  }

  ngOnInit(): void {
    this.route.parent?.paramMap.subscribe((params) => {
      this.eventId = params.get('id');
      this.getRegisteredUsers(this.eventId);
    });
    this.authUser = this.authService.getUser() as AuthUser;
    const modalEl = document.getElementById('participantModal');
    const deleteEl = document.getElementById('deleteModal');
    this.getChurches()
  }

  getSizes() {
    this.apiService.getSizes().subscribe({
      next: (response: ApiResponse<Sizes[]>) => {
        this.sizes.set(response.data);
      },
      error: (error: HttpErrorResponse) => { },
    });
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
    this.editModal?.dispose();
  }

  getChurches() {
    this.eventsService.getChurches().subscribe({
      next: (response: ApiResponse<Churches[]>) => {
        this.churchesMasterList = response.data
      },
      error: (error: HttpErrorResponse) => {
        this.cargando = false;
      },
      complete: () => {
        this.cargando = false;
      },
    })
  }

  getRegisteredUsers(eventId: any) {
    this.cargando = true;
    this.eventsService.getRegisteredUsers(eventId).subscribe({
      next: (response: ApiResponse<RegisteredUsers[]>) => {
        this.participantes = response.data;
      },
      error: (error: HttpErrorResponse) => {
        this.cargando = false;
      },
      complete: () => {
        this.cargando = false;
      },
    });
  }

  onProductoChange() {
    if (this.filtroProductos !== 'playera') {
      this.filtroTalla = '';
    }

    this.onFiltroChange();
    this.paginaActual = 1;
  }

  get iglesiasVisibles(): string[] {
    if (this.filtroConferencia) {
      return this.churchesMasterList
        .filter(c => c.nombreConferencia === this.filtroConferencia)
        .map(c => c.iglesia);
    }
    return this.churchesMasterList.map(c => c.iglesia);
  }

  get conferenciasVisibles(): string[] {
    if (this.filtroIglesia) {
      const iglesia = this.churchesMasterList.find(c => c.iglesia === this.filtroIglesia);
      if (iglesia) {
        return [iglesia.nombreConferencia];
      }
    }
    return this.conferenciasBase;
  }
  // ---------- datos derivados (búsqueda + paginación) ----------
  get participantesFiltrados(): RegisteredUsers[] {
    const terminos = this.busqueda.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return this.participantes.filter(p => {
      let coincideProductos: boolean = true
      let coincideTalla: boolean = true
      // Búsqueda por texto (todas las palabras deben coincidir en cualquier orden)
      const textoCompleto = `${p.nombre ?? ''} ${p.apellidos ?? ''} ${p.telefono ?? ''} ${p.correo ?? ''}`.toLowerCase();
      const coincideBusqueda = terminos.length === 0 || terminos.every(t => textoCompleto.includes(t));

      // Filtro por Conferencia
      if (this.filtroProductos == 'comida') {

        coincideProductos = !this.filtroProductos || p.incluir_lunchtime == 1;
      } else {

        coincideProductos = !this.filtroProductos || p.incluir_camisa == 1;
        if (this.filtroTalla) {
          coincideTalla = p.talla === this.filtroTalla;
        }
      }

      const coincideConferencia = !this.filtroConferencia || p.conferencia === this.filtroConferencia;
      // Filtro por Iglesia (NUEVO)
      const coincideIglesia = !this.filtroIglesia || this.eventsService.normalizarIglesia(p.iglesia) === this.filtroIglesia;

      // Retornamos combinando todas las condiciones
      return coincideBusqueda && coincideConferencia && coincideIglesia && coincideProductos && coincideTalla;
    });
  }

  get totalPaginas(): number {
    return Math.max(
      1,
      Math.ceil(this.participantesFiltrados.length / this.porPagina),
    );
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

  onBusquedaChange(): void {
    this.paginaActual = 1;
  }

  onIglesiaChange(): void {
    this.paginaActual = 1;

    if (this.filtroIglesia) {
      const iglesia = this.churchesMasterList.find(c => c.iglesia === this.filtroIglesia);
      if (iglesia) {
        this.filtroConferencia = iglesia.nombreConferencia;
      }
    }
  }

  onConferenciaChange(): void {
    this.paginaActual = 1;

    if (this.filtroConferencia && this.filtroIglesia) {
      const iglesiaValida = this.churchesMasterList.find(
        c => c.iglesia === this.filtroIglesia && c.nombreConferencia === this.filtroConferencia
      );
      if (!iglesiaValida) {
        this.filtroIglesia = '';
      }
    }
  }


  onFiltroChange(): void {
    this.paginaActual = 1;
  }

  onPorPaginaChange(): void {
    this.paginaActual = 1;
    this.skeletonRows = Array.from({ length: this.porPagina });
  }

  irAPagina(pagina: number | string): void {
    if (pagina === '...') return;
    const destino = Math.min(Math.max(Number(pagina), 1), this.totalPaginas);
    this.paginaActual = destino;
  }

  anterior(): void {
    this.irAPagina(this.paginaActual - 1);
  }
  siguiente(): void {
    this.irAPagina(this.paginaActual + 1);
  }

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
        this.getRegisteredUsers(this.eventId);
      },
      error: (error: HttpErrorResponse) => { },
      complete: () => { },
    });
  }

  public isoADdmmyyyy(fecha: string | null): string {
    if (!fecha) return '';

    const dateObj = new Date(fecha);

    if (isNaN(dateObj.getTime())) return fecha;

    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();

    let resultado = `${d}/${m}/${y}`;

    /* if (fecha.includes('T')) {
      let horas = dateObj.getHours();
      const minutos = String(dateObj.getMinutes()).padStart(2, '0');
      const ampm = horas >= 12 ? 'PM' : 'AM';

      horas = horas % 12;
      horas = horas ? horas : 12;

      const horasStr = String(horas).padStart(2, '0');

      resultado += ` ${horasStr}:${minutos} ${ampm}`;
    } */

    return resultado;
  }

  /* EXPORTAR INFORME EN PDF */
  exportPdf(): void {
    const headers = [
      'NOº',
      'Nombre',
      'Camiseta',
      'Talla',
      'Comida',
      'Iglesia',
      'Conferencia',
    ];

    const rows: (string | number)[][] = this.participantesFiltrados.map((p, i) => [
      i + 1,

      `${p.nombre ?? ''} ${p.apellidos ?? ''}`.trim(),

      p.pago_camiseta ?? '',

      p.talla ?? '',

      p.pago_lunchtime ?? '',

      p.iglesia ?? '',

      p.conferencia ?? '',

      /* this.isoADdmmyyyy(p.created_at), */
    ]);

    this.PdfProductsService.exportTshirtsReport(rows, {
      conferencia: this.filtroConferencia,
      iglesia: this.filtroIglesia,
      busqueda: this.busqueda,
    });

  }
}
