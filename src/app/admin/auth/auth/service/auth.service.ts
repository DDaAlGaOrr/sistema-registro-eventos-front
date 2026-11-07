import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, tap, throwError } from 'rxjs';
import { ApiResponse } from '../../../../core/models/api-response.interface';
import { URL_API } from '../../../../environment/environment';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'superadmin' | 'finanzas' | 'staff' | 'vicePresident' | 'developer' | 'admin';
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<AuthUser | null>(this.loadUser());
  user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
  ) { }

  // ── Login Mock Temporal ───────────────────────────────────────────────────
  // login(email: string, password: string): Observable<LoginResponse> {
  //   // Definimos las credenciales simuladas obligatorias
  //   const VALID_EMAIL = 'admin@congreso.com';
  //   const VALID_PASSWORD = 'admin123';

  //   if (email === VALID_EMAIL && password === VALID_PASSWORD) {
  //     const mockResponse: LoginResponse = {
  //       token: 'jwt_mock_token_12345',
  //       user: {
  //         id: 1,
  //         name: 'Webmaster Admin',
  //         email: email,
  //         role: 'admin',
  //         sport: null,
  //       },
  //     };

  //     return of(mockResponse).pipe(
  //       tap((response) => {
  //         localStorage.setItem(TOKEN_KEY, response.token);
  //         localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  //         this.userSubject.next(response.user);
  //       }),
  //     );
  //   } else {
  //     // Si no coinciden, simulamos un error del servidor (status 401)
  //     return throwError(() => ({
  //       status: 401,
  //       error: {
  //         error:
  //           'Credenciales incorrectas. Intenta con admin@congreso.com y admin123',
  //       },
  //     }));
  //   }
  // }

  login(email: string, password: string): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>(`${URL_API}/auth/login`, { email, password }).pipe(
      tap(response => {
        localStorage.setItem(TOKEN_KEY, response.data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        this.userSubject.next(response.data.user);
      })
    );
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getUser(): AuthUser | null {
    return this.userSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }


  // ── Helpers privados ──────────────────────────────────────────────────────

  private loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
