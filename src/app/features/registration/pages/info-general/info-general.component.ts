import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ApiService } from './../../../../core/services/api.service';
import { EventData } from '../../../../core/models/event.interface';
import { ApiResponse } from '../../../../core/models/api-response.interface';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-info-general',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './info-general.component.html',
  styleUrl: './info-general.component.scss'
})
export class InfoGeneralComponent {
  private readonly apiService = inject(ApiService)
  private readonly route = inject(ActivatedRoute)
  email: string = "fesjarizona@gmail.com"
  eventId: string | null = null;
  eventData = signal<EventData>({} as EventData);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe(params => {
      this.eventId = params.get('id');
      this.getEventData(this.eventId)
    });
  }

  getEventData(eventId: any) {
    this.apiService.getEvent(eventId).subscribe({
      next: (response: ApiResponse<EventData>) => {
        this.eventData.set(response.data)
      },
      error: (error: HttpErrorResponse) => {
      },
      complete: () => {
      },
    })
  }
}
