import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiError } from '../core/models';
import { SessionService } from '../core/session.service';
import { AuthCardComponent } from './auth-card.component';

@Component({
    selector: 'app-login-v2',
    standalone: true,
    imports: [ReactiveFormsModule, RouterLink, TranslateModule, AuthCardComponent],
    template: `
    <app-auth-card [title]="'V2.AUTH.LOGIN_TITLE' | translate" [subtitle]="'V2.AUTH.LOGIN_SUBTITLE' | translate">
      @if (expired) { <div class="alert alert-info py-2 small">{{ 'V2.AUTH.SESSION_EXPIRED' | translate }}</div> }
      @if (error()) { <div class="alert alert-danger py-2 small" role="alert">{{ error() }}</div> }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="mb-3">
          <label class="form-label" for="email">{{ 'V2.AUTH.EMAIL' | translate }}</label>
          <input id="email" type="email" class="form-control" formControlName="email" autocomplete="username" autofocus />
        </div>
        <div class="mb-2">
          <label class="form-label" for="password">{{ 'V2.AUTH.PASSWORD' | translate }}</label>
          <input id="password" type="password" class="form-control" formControlName="password" autocomplete="current-password" />
        </div>
        <div class="text-end mb-3">
          <a routerLink="/recuperar" class="small">{{ 'V2.AUTH.FORGOT' | translate }}</a>
        </div>
        <button type="submit" class="btn btn-brand w-100" [disabled]="form.invalid || loading()">
          {{ (loading() ? 'V2.AUTH.SIGNING_IN' : 'V2.AUTH.SIGN_IN') | translate }}
        </button>
      </form>
    </app-auth-card>
  `,
})
export class LoginV2Component {
    private fb = inject(FormBuilder);
    private session = inject(SessionService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private translate = inject(TranslateService);

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly expired = this.route.snapshot.queryParamMap.has('expirada');

    readonly form = this.fb.nonNullable.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', Validators.required],
    });

    submit() {
        if (this.form.invalid) return;
        this.loading.set(true);
        this.error.set(null);
        const { email, password } = this.form.getRawValue();
        this.session.login(email, password).subscribe({
            next: () => {
                const back = this.route.snapshot.queryParamMap.get('volver');
                // Solo rutas internas del panel
                this.router.navigateByUrl(back && back.startsWith('/admin') ? back : '/admin');
            },
            error: (e: ApiError) => {
                this.loading.set(false);
                this.error.set(e.message);
                this.form.controls.password.reset();
            },
        });
    }
}
