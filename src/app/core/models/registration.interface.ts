export interface RegistrationData {
  personalDetails: PersonalDetails;
  emergencyContact: EmergencyContact;
  isChaperone: boolean;
}

export interface PersonalDetails {
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  genero: string;
  estado: string;
  ciudad: string;
  iglesia: string;
  tallaCamiseta: string;
}

export interface EmergencyContact {
  nombre: string;
  telefono: string;
  relacion: string;
}
