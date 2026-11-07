import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-footer-bar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './footer-bar.component.html',
  styleUrls: ['./footer-bar.component.scss']
})
export class FooterBarComponent {
  // Recibe si el paso actual es el primero (para deshabilitar el botón "Atrás")
  @Input() isFirstStep = true;

  // Recibe si el formulario del paso actual es válido (para habilitar el botón "Siguiente")
  @Input() isCurrentStepValid = false;

  // Emisores de eventos para avisar al componente padre
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  onPrevious(): void {
    if (!this.isFirstStep) {
      this.previous.emit();
    }
  }

  onNext(): void {
    if (this.isCurrentStepValid) {
      this.next.emit();
    }
  }
}
