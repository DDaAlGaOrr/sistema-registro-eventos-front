import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { RegistrationFormService } from '../../../../core/services/registration-form.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-step5-recibido',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './step5-recibido.component.html',
  styleUrl: './step5-recibido.component.scss'
})
export class Step5RecibidoComponent implements OnInit, OnDestroy {
  private formService = inject(RegistrationFormService);
  private router = inject(Router);
  private redirectTimer: ReturnType<typeof setTimeout> | null = null;
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  eventId: string | null = null;


  ngOnInit(): void {
    this.route.parent?.paramMap.subscribe(params => {
      this.eventId = params.get('id');
      this.iniciarRedireccion();
    });
  }

  iniciarRedireccion() {
    this.redirectTimer = setTimeout(() => {
      this.formService.stepperForm.reset();
      window.location.href = `/registro/${this.eventId}`;
    }, 10000);
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
      this.redirectTimer = null;
    }
  }

  get primerNombre(): string {
    const name: string = this.formService.stepperForm.get('paso1')?.value?.name || '';
    return name.split(' ')[0] || this.translate.instant('STEP5.DefaultName');
  }

  get correoElectronico(): string {
    return this.formService.stepperForm.get('paso1')?.value?.email || '';
  }

  irAFeja(): void {
    window.open('https://congreso-union.fesjaz.com', '_blank');
  }
}
