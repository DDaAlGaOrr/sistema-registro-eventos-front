
export interface StatCard {
  icon: string;
  label: string;
  value: number;
}

export interface RecentActivity {
  nombre: string;
  apellidos: string;
  conferencia: string;
  correo: string;
  created_at: string;
}

export interface StaffMember {
  nombre: string;
  cargo: string;
  estado: 'Completado' | 'Pending';
  initials: string;
}


export interface DashboardData {
  stats: StatCard[];
  activities: RecentActivity[];
  staff: StaffMember[];
}


export interface WeeklyRegistrationsData {
  categories: string[];
  seriesData: number[];
  total: number;
}

export interface ChartSeries {
  name: string;
  data: number[];
}

export interface GenderByMonthData {
  categories: string[];
  series: ChartSeries[];
}

export interface TshirtSizesData {
  labels: string[];
  series: number[];
  total: number;
}

export interface Churches {
  iglesia: string,
  conferenciaId: number,
  nombreConferencia: string
}

export interface RegisteredUsers {
  id: number;
  nombre: string;
  conferencia: string;
}

export interface ConferenceRegistered {
  nombre: string;
  usuariosRegistrados: number;
}
