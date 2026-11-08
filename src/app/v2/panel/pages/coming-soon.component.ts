import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

/** Secciones que se construyen en los siguientes pasos (11 y 13). */
@Component({
    selector: 'app-coming-soon',
    standalone: true,
    imports: [TranslateModule],
    template: `
    <h1 class="page-title mb-3">{{ title | translate }}</h1>
    <div class="panel-card text-center py-5">
      <i class="bi bi-tools fs-2 text-muted"></i>
      <p class="fw-semibold mt-2 mb-1">{{ 'V2.COMMON.COMING_SOON' | translate }}</p>
      <p class="text-muted small mb-0">{{ 'V2.COMMON.COMING_SOON_TEXT' | translate }}</p>
    </div>
  `,
})
export class ComingSoonComponent {
    readonly title: string = inject(ActivatedRoute).snapshot.data['title'] ?? '';
}
