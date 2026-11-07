export interface UserDataRegister {
    conferencia_id: number,
    nombre_conferencia: string,
    talla_camiseta_id: number,
    nombre: string,
    apellidos: string,
    correo: string,
    telefono: string,
    fecha_nacimiento: string,
    genero: string,
    estado_id: number,
    nombre_estado: string,
    ciudad: string,
    iglesia: string
    incluir_lunchtime: boolean| null,
    es_chaperon: boolean,
    incluir_camisa: boolean | null,
    alimento_especial_nota: string | null,
    tipo_alimento: string | null
    contacto_emergencia: EmergencyData
}

export interface EmergencyData {
    nombre_contacto: string
    telefono_contacto: string,
    relacion: string
}

export interface PayData {
    concepto: 'camiseta' | 'lunchtime';
    estatus_nuevo: 'pendiente' | 'pagado' | 'no_aplica';
    notas?: string;
}
