import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiV2Service } from '../core/api.service';
import { ApiError, Session } from '../core/models';
import { SessionService } from '../core/session.service';
import { AuthCardComponent } from './auth-card.component';

/** Mismas reglas que la API: 10+ caracteres, con letras y números. */
const strongPassword = (c: AbstractControl): ValidationErrors | null => {
    const v = String(c.value ?? '');
    return v.length >= 10 && /[A-Za-z]/.test(v) && /\d/.test(v) ? null : { weak: true };
};

/**
 * Crear contraseña: sirve para aceptar una invitación (/invitacion?token=)
 * y para restablecerla (/restablecer?token=). El modo viene en la ruta.
 */
@Component({
    selector: 'app-set-password',
    standalone: true,
    imports: [ReactiveFormsModule, RouterLink, TranslateModule, AuthCardComponent],
    template: `
    <app-auth-card [title]="(mode === 'invite' ? 'V2.AUTH.INVITE_TITLE' : 'V2.AUTH.RESET_TITLE') | translate"
                   [subtitle]="mode === 'invite' ? ('V2.AUTH.INVITE_TEXT' | translate) : ''">
      @if (!token) {
        <div class="alert alert-warning small">{{ 'V2.AUTH.TOKEN_MISSING' | translate }}</div>
      } @else if (done()) {
        <div class="alert alert-success small">{{ done() }}</div>
        <a routerLink="/login" class="btn btn-brand w-100">{{ 'V2.AUTH.BACK_TO_LOGIN' | translate }}</a>
      } @else {
        @if (error()) { <div class="alert alert-danger py-2 small">{{ error() }}</div> }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="mb-3">
            <label class="form-label" for="password">{{ 'V2.AUTH.NEW_PASSWORD' | translate }}</label>
            <input id="password" type="password" class="form-control" formControlName="password" autocomplete="new-password" autofocus
                   [class.is-invalid]="form.controls.password.touched && form.controls.password.invalid" />
            <div class="form-text">{{ 'V2.AUTH.PASSWORD_RULES' | translate }}</div>
          </div>
          <div class="mb-3">
            <label class="form-label" for="confirm">{{ 'V2.AUTH.CONFIRM_PASSWORD' | translate }}</label>
            <input id="confirm" type="password" class="form-control" formControlName="confirm" autocomplete="new-password"
                   [class.is-invalid]="form.controls.confirm.touched && mismatch()" />
            @if (form.controls.confirm.touched && mismatch()) {
              <div class="invalid-feedback d-block">{{ 'V2.AUTH.PASSWORDS_DONT_MATCH' | translate }}</div>
            }
          </div>
          <button type="submit" class="btn btn-brand w-100" [disabled]="form.invalid || mismatch() || loading()">
            {{ (mode === 'invite' ? 'V2.AUTH.ACTIVATE' : 'V2.AUTH.SAVE_PASSWORD') | translate }}
          </button>
        </form>
      }
    </app-auth-card>
  `,
})
export class SetPasswordComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private api = inject(ApiV2Service);
    private session = inject(SessionService);

    readonly mode: 'invite' | 'reset' = this.route.snapshot.data['mode'];
    token: string | null = null;
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly done = signal<string | null>(null);
    readonly form = inject(FormBuilder).nonNullable.group({
        password: ['', [Validators.required, strongPassword]],
        confirm: ['', Validators.required],
    });

    ngOnInit() {
        this.token = this.route.snapshot.queryParamMap.get('token');
    }

    mismatch() {
        const { password, confirm } = this.form.getRawValue();
        return !!confirm && password !== confirm;
    }

    submit() {
        if (!this.token || this.form.invalid || this.mismatch()) return;
        this.loading.set(true);
        this.error.set(null);
        const body = { token: this.token, password: this.form.getRawValue().password };
        const onError = (e: ApiError) => { this.error.set(e.message); this.loading.set(false); };

        if (this.mode === 'invite') {
            this.api.post<Session | { message: string }>('/auth/invitation/accept', body).subscribe({
                next: r => {
                    if ('accessToken' in r) {
                        this.session.setSession(r);
                        this.router.navigateByUrl('/admin');
                    } else {
                        this.done.set(r.message);
                    }
                },
                error: onError,
            });
        } else {
            this.api.post<{ message: string }>('/auth/password/reset', body).subscribe({
                next: r => this.done.set(r.message),
                error: onError,
            });
        }
    }
}
