import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../../core/services/dashboard.service';
import { StatCard, RecentActivity, ConferenceRegistered, StaffMember } from '../../../core/models/dashboard.model';
import { EventsService } from '../../../core/services/events.service';
import { ParticipantesService } from '../../../core/services/participants.service';
import { RegisteredUsers } from '../../../core/models/events.model';

import {
  ChartComponent,
  ApexAxisChartSeries,
  ApexNonAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexTitleSubtitle,
  ApexDataLabels,
  ApexStroke,
  ApexFill,
  ApexLegend,
  ApexTooltip,
  ApexMarkers,
  ApexPlotOptions,
  ApexResponsive,
  ApexGrid,
  ApexAnnotations,
  ApexStates,
  ApexTheme,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { URL_API } from '../../../../environment/environment';
import { ApiResponse } from '../../../../core/models/api-response.interface';

export type ChartOptions = {
  series?: ApexAxisChartSeries | ApexNonAxisChartSeries;
  chart?: ApexChart;
  xaxis?: ApexXAxis;
  yaxis?: ApexYAxis | ApexYAxis[];
  title?: ApexTitleSubtitle;
  subtitle?: ApexTitleSubtitle;
  dataLabels?: ApexDataLabels;
  stroke?: ApexStroke;
  fill?: ApexFill;
  legend?: ApexLegend;
  tooltip?: ApexTooltip;
  markers?: ApexMarkers;
  plotOptions?: ApexPlotOptions;
  responsive?: ApexResponsive[];
  grid?: ApexGrid;
  annotations?: ApexAnnotations;
  states?: ApexStates;
  theme?: ApexTheme;
  colors?: string[];
  labels?: any;
};

@Component({
  standalone: true,
  selector: 'app-overview-congreso',
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './overview-congreso.component.html',
  styleUrls: ['./overview-congreso.component.scss'],
})
export class OverviewCongresoComponent
  implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chart') chart!: ChartComponent;

  // ---------- ESTADOS INICIALES (VACÍOS) DE LAS GRÁFICAS ----------

  // 1. Gráfica de Tallas de Camisas
  public chartOptionsTshirts: Partial<ChartOptions> = {
    series: [], // Se llena dinámicamente
    labels: [], // Se llena dinámicamente
    chart: { height: 250, type: 'radialBar' },
    colors: ['#CD7F32', '#FFAC1C', '#CC5500', '#E49B0F'],
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      floating: false,
    },
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        hollow: {
          size: '35%',
        },
        track: {
          background: '#f3e5d3',
          strokeWidth: '100%',
        },
        dataLabels: {
          name: {
            show: true,
            fontSize: '12px',
            color: '#4b2e1f',
          },
          value: {
            show: true,
            fontSize: '18px',
            fontWeight: 700,
            color: '#2e1d12',
            formatter: (val: number) => `${Math.round(val)}`,
          },
          total: {
            show: true,
            label: 'Camisas',
            color: '#2e1d12',
            formatter: (w: any) => {
              const totals = w.globals?.seriesTotals ?? [];
              return totals
                .reduce((sum: number, value: number) => sum + value, 0)
                .toString();
            },
          },
        },
      },
    },
  };

  // 2. Gráfica de Género por Mes (Barras)
  public chartOptions: Partial<ChartOptions> = {
    series: [], // Se llena dinámicamente
    xaxis: { categories: [] }, // Se llena dinámicamente
    chart: { type: 'bar', height: 350 },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        borderRadius: 5,
        borderRadiusApplication: 'end',
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    yaxis: { title: { text: '(Cantidad)' } },
    fill: { opacity: 1, colors: ['#B87333', '#F4BB44'] },
    tooltip: {
      y: {
        formatter: (val) => val + ' en total',
      },
    },
  };

  // 3. Gráfica de Inscripciones por Semana (Sparkline)
  public chartOptions3: Partial<ChartOptions> = {
    series: [], // Se llena dinámicamente
    xaxis: { crosshairs: { width: 1 }, categories: [] }, // Se llena dinámicamente
    title: {
      text: '0', // Se actualiza dinámicamente
      offsetX: 0,
      style: { fontSize: '24px' },
    },
    chart: { type: 'area', height: 190, sparkline: { enabled: true } },
    stroke: { curve: 'smooth' },
    fill: { opacity: 0.3, colors: ['#FFA500', '#E49B0F', '#DAA520'] },
    yaxis: { min: 0 },
    subtitle: {
      text: 'Inscripciones',
      offsetX: 0,
      style: { fontSize: '14px' },
    },
  };

  ngAfterViewInit() {
    (window as any).Apex = {
      stroke: { width: 3 },
      markers: { size: 0 },
      tooltip: { fixed: { enabled: true } },
    };
  }

  baseUrlIcon: string = '../../../../../assets/icons/admin/';

  private dashboardService = inject(DashboardService);
  private participantesService = inject(ParticipantesService);
  private eventsService = inject(EventsService);
  private cdr = inject(ChangeDetectorRef);

  // ---------- estado de carga ----------
  cargandoStats = true;
  cargandoActivities = true;
  cargandoConferences = true;
  cargandoStaff = true;
  skeletonCards = Array.from({ length: 4 });
  skeletonTable = Array.from({ length: 6 });

  public statsList: StatCard[] = [];
  public activitiesList: RecentActivity[] = [];
  public conferencesRegistered: ConferenceRegistered[] = [];
  public staffList: StaffMember[] = [];
  actividadReciente: any[] = [];
  private eventSource!: EventSource;

  ngOnInit(): void {
    // Datos originales del dashboard
    this.loadDashboardData();

    // SSE para actividades
    this.conectarSSE();

    // Conferencias y usuarios registrados

    // Gráficas
    const eventId = 2;

    this.loadConferencesRegistered(eventId);
    this.getWeeklyRegistrations(eventId);
    this.getGenderByMonth(eventId);
    this.getTshirtSizes(eventId);
  }

  private loadConferencesRegistered(eventId: number): void {
    this.cargandoConferences = true;

    this.eventsService.getRegisteredUsers(eventId).subscribe({
      next: ((participants: ApiResponse<RegisteredUsers[]>) => {
        this.conferencesRegistered = this.agruparPorConferencia(participants.data);
      }),
      error: (err) => {
        console.error('Error al cargar participantes:', err);

        this.cargandoConferences = false;
      },

      complete: () => {
        this.cargandoConferences = false;
      },
    });
  }

  private agruparPorConferencia(
    participants: RegisteredUsers[],
  ): ConferenceRegistered[] {
    const grupos = new Map<string, number>();

    participants.forEach((participant) => {
      const conferencia = participant.conferencia;

      if (!conferencia) {
        return;
      }

      grupos.set(conferencia, (grupos.get(conferencia) ?? 0) + 1);
    });

    return Array.from(grupos.entries()).map(
      ([nombre, usuariosRegistrados]) => ({
        nombre,
        usuariosRegistrados,
      }),
    );
  }

  public obtenerLogoConferencia(nombre: string): string {
    const nombreNormalizado = nombre.trim().toLowerCase();

    if (nombreNormalizado.includes('arizona')) {
      return 'assets/icons/admin/conferences-svg/arizona.svg';
    }

    if (nombreNormalizado.includes('central california conference')) {
      return 'assets/icons/admin/conferences-svg/california centro.svg';
    }

    if (nombreNormalizado.includes('hawaii')) {
      return 'assets/icons/admin/conferences-svg/hawaii.svg';
    }

    if (nombreNormalizado.includes('nevada')) {
      return 'assets/icons/admin/conferences-svg/nevada.svg';
    }

    if (nombreNormalizado.includes('northern california conference')) {
      return 'assets/icons/admin/conferences-svg/california norte.svg';
    }

    if (nombreNormalizado.includes('southeastern california conference')) {
      return 'assets/icons/admin/conferences-svg/california sureste.svg';
    }

    if (nombreNormalizado.includes('southern california conference')) {
      return 'assets/icons/admin/conferences-svg/california sur.svg';
    }

    return '';
  }

  // ---------- LLAMADAS A LA API DE GRÁFICAS ----------

  getWeeklyRegistrations(eventId: number) {
    this.dashboardService.getWeeklyRegistrations(eventId).subscribe({
      next: (result) => {
        const data = result.data;
        // Reasignamos el objeto completo para que ApexCharts detecte el cambio
        this.chartOptions3 = {
          ...this.chartOptions3,
          series: [{ name: 'Inscripciones', data: data.seriesData }],
          xaxis: { ...this.chartOptions3.xaxis, categories: data.categories },
          title: { ...this.chartOptions3.title, text: `${data.total}` },
        };
      },
      error: (err) => console.error('Error al cargar stats semanales', err),
    });
  }

  getGenderByMonth(eventId: number) {
    this.dashboardService.getGenderByMonth(eventId).subscribe({
      next: (result) => {
        const data = result.data;
        this.chartOptions = {
          ...this.chartOptions,
          series: data.series,
          xaxis: { ...this.chartOptions.xaxis, categories: data.categories },
        };
      },
      error: (err) => console.error('Error al cargar stats por género', err),
    });
  }

  getTshirtSizes(eventId: number) {
    this.dashboardService.getTshirtSizes(eventId).subscribe({
      next: (result) => {
        const data = result.data;
        this.chartOptionsTshirts = {
          ...this.chartOptionsTshirts,
          series: data.series ?? [],
          labels: data.labels ?? [],
        };
        this.forceChartResize();
      },
      error: (err) => console.error('Error al cargar stats de camisas', err),
    });
  }

  // ---------- RESTO DE TU LÓGICA (SSE, DASHBOARD, FECHAS) ----------

  conectarSSE() {
    this.eventSource = new EventSource(`${URL_API}/events/stream`);

    this.eventSource.onmessage = (event) => {
      const nuevoRegistro = JSON.parse(event.data);
      this.activitiesList.unshift(nuevoRegistro);
      if (this.activitiesList.length > 5) {
        this.activitiesList.pop();
      }
      this.cdr.detectChanges();
    };

    this.eventSource.onerror = (error) => {
      console.error('Error en SSE:', error);
    };
  }

  ngOnDestroy() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }

  private loadDashboardData(): void {
    this.cargandoStats = true;
    this.eventsService.getResumen(2).subscribe({
      next: (result) => {
        this.statsList = result.data;
      },
      error: (err) => {
        console.error('Error al cargar stats', err);
        this.cargandoStats = false;
      },
      complete: () => {
        this.cargandoStats = false;
        this.forceChartResize();
      },
    });

    this.cargandoActivities = true;

    this.eventsService.getRecentActivities(2).subscribe({
      next: (response) => {
        this.activitiesList = response.data;
      },
      error: (err) => {
        console.error('Error al cargar actividades', err);
        this.cargandoActivities = false;
      },
      complete: () => {
        this.cargandoActivities = false;
        this.forceChartResize();
      },
    });

    this.cargandoStaff = true;
    this.dashboardService.getStaffMembers().subscribe({
      next: (data) => (this.staffList = data),
      error: (err) => {
        console.error('Error al cargar staff', err);
        this.cargandoStaff = false;
      },
      complete: () => {
        this.cargandoStaff = false;
        this.forceChartResize();
      },
    });
  }

  public isoADdmmyyyy(fecha: string | null): string {
    if (!fecha) return '';
    const dateObj = new Date(fecha);
    if (isNaN(dateObj.getTime())) return fecha;

    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();

    return `${d}/${m}/${y}`;
  }

  public calcularTiempoTranscurrido(fecha: string | null): string {
    if (!fecha) return '';

    const registro = new Date(fecha);
    const hoy = new Date();

    // Normalizamos ambas fechas a las 00:00:00 para comparar solo el calendario
    registro.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);

    const diffTime = hoy.getTime() - registro.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Hace 1 día';
    if (diffDays > 1) return `Hace ${diffDays} días`;

    return this.isoADdmmyyyy(fecha);
  }

  private forceChartResize() {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 500); // Esperamos 500ms para que el DOM esté listo
  }
}
