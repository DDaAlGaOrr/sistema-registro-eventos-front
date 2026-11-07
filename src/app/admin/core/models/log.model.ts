export type LogAccion = 'UPDATE_REGISTER' | 'DELETE_REGISTER' | 'CHECK_IN' | 'CREATE_REGISTER';

export interface AdminLog {
  adminName: string;
  action: LogAccion;
  afectedRegister: string;
  details: string | null;
  created_at: string;
}
