export type EstadoCheckin = 'Completado' | 'Pendiente';

/** Estado de pago, usado para la camiseta y la comida del participante */
export type EstadoPago = 'Pagado' | 'Pendiente';

/** Tallas de camiseta disponibles */
export type TallaCamiseta = 'SM' | 'MD' | 'LG' | 'XL';

/** Las 6 conferencias válidas, agrupadas por región */
export type Conferencia =
  | 'Arizona Conference'
  | 'Central California Conference'
  | 'Hawaii Conference'
  | 'Nevada-Utah Conference'
  | 'Northern California Conference'
  | 'Southeastern California Conference'
  | 'Southern California Conference';

/** Los 4 estados válidos. Se derivan siempre de la conferencia, nunca se eligen sueltos. */
export type Estado = 'Arizona' | 'Nevada' | 'California' | 'Hawaii';

export interface Participante {
  id: number;
  nombre: string;
  telefono: string;
  conferencia: Conferencia;
  /** Derivado de "conferencia" según ESTADO_POR_CONFERENCIA, nunca se edita de forma independiente */
  estado: Estado;
  checkin: EstadoCheckin;
  /** Formato dd/mm/yyyy, igual que en registrados.json */
  registro: string;
  camiseta: EstadoPago;
  talla: TallaCamiseta;
  comida: EstadoPago;
}

/** Forma usada al crear un participante nuevo (el id lo asigna el servicio) */
export type NuevoParticipante = Omit<Participante, 'id'>;

/**
 * Mapeo fijo conferencia -> estado:
 * - Hawaii pertenece a Hawaii.
 * - California Sur / Centro / Norte pertenecen a California.
 * - Arizona pertenece a Arizona.
 * - Nevada pertenece a Nevada.
 */



export const ESTADOS_DISPONIBLES: Estado[] = ['Arizona', 'Nevada', 'California', 'Hawaii'];

export const TALLAS_DISPONIBLES: TallaCamiseta[] = ['SM', 'MD', 'LG', 'XL'];

export const ESTADOS_PAGO_DISPONIBLES: EstadoPago[] = ['Pagado', 'Pendiente'];
