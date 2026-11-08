import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiV2Service } from '../core/api.service';
import { ApiError } from '../core/models';
import { AuthCardComponent } from './auth-card.component';

@Component({
    selector: 'app-forgot-password',
    standalone: true,
    imports: [ReactiveFormsModule, RouterLink, TranslateModule, AuthCardComponent],
    template: `
    <app-auth-card [title]="'V2.AUTH.FORGOT_TITLE' | translate" [subtitle]="'V2.AUTH.FORGOT_TEXT' | translate">
      @if (sent()) {
        <div class="alert alert-success small">{{ sent() }}</div>
      } @else {
        @if (error()) { <div class="alert alert-danger py-2 small">{{ error() }}</div> }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="mb-3">
            <label class="form-label" for="email">{{ 'V2.AUTH.EMAIL' | translate }}</label>
            <input id="email" type="email" class="form-control" formControlName="email" autocomplete="email" autofocus />
          </div>
          <button type="submit" class="btn btn-brand w-100" [disabled]="form.invalid || loading()">{{ 'V2.AUTH.SEND_LINK' | translate }}</button>
        </form>
      }
      <div class="text-center mt-3"><a routerLink="/login" class="small">{{ 'V2.AUTH.BACK_TO_LOGIN' | translate }}</a></div>
    </app-auth-card>
  `,
})
export class ForgotPasswordComponent {
    private api = inject(ApiV2Service);
    readonly form = inject(FormBuilder).nonNullable.group({ email: ['', [Validators.required, Validators.email]] });
    readonly loading = signal(false);
    readonly sent = signal<string | null>(null);
    readonly error = signal<string | null>(null);

    submit() {
        this.loading.set(true);
        this.error.set(null);
        this.api.post<{ message: string }>('/auth/password/forgot', this.form.getRawValue()).subscribe({
            next: r => this.sent.set(r.message),
            error: (e: ApiError) => { this.error.set(e.message); this.loading.set(false); },
        });
    }
}
