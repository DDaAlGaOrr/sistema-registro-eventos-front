import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { EventContextService } from '../event-context.service';

/** Contenedor de /admin/eventos/:eventId/...: fija el evento elegido. */
@Component({
    selector: 'app-event-shell',
    standalone: true,
    imports: [RouterOutlet, RouterLink, TranslateModule],
    template: `
    @if (notFound()) {
      <div class="panel-card text-center py-5">
        <p class="mb-3">{{ 'V2.PANEL.SELECT_EVENT' | translate }}</p>
        <a routerLink="/admin/eventos" class="btn btn-brand">{{ 'V2.PANEL.MENU.EVENTS' | translate }}</a>
      </div>
    } @else {
      <router-outlet />
    }
  `,
})
export class EventShellComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private destroyRef = inject(DestroyRef);
    readonly context = inject(EventContextService);

    /** La lista ya cargó y el evento no está (no existe o no lo puede ver). */
    readonly notFound = computed(() => this.context.events() !== null && this.context.current() === null);

    ngOnInit() {
        this.context.load();
        this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(p => this.context.select(Number(p.get('eventId')) || null));
    }
}
