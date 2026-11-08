import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { API_V2 } from '../../environment/environment';
import { ApiV2Service, toApiError } from '../core/api.service';
import { Locale } from '../core/models';
import {
    ActivityItem, AuditEntry, AuditFilters, CheckinResult, CheckinSummary, EventReport, EventPaymentsPage, FormItemsView, ManualPaymentInput, Member, OrgNode, Page, PaymentFilters, RegistrationDetail, RegistrationFilters, RegistrationListItem,
    RegistrationSort, RegistrationUpdate,
} from './admin.models';

/** Parámetros de consulta de la lista de registros (sin vacíos). */
export function registrationQuery(
    filters: RegistrationFilters,
    paging: { page: number; pageSize: number; sort: RegistrationSort; order: 'asc' | 'desc' },
): Record<string, string | number> {
    const query: Record<string, string | number> = {
        page: paging.page, pageSize: paging.pageSize, sort: paging.sort, order: paging.order,
    };
    const q = filters.q?.trim();
    if (q) query['q'] = q;
    if (filters.conferenceId) query['conferenceId'] = filters.conferenceId;
    if (filters.status) query['status'] = filters.status;
    if (filters.paymentStatus) query['paymentStatus'] = filters.paymentStatus;
    if (filters.checkedIn) query['checkedIn'] = filters.checkedIn;
    if (filters.deleted) query['deleted'] = filters.deleted;
    if (filters.itemCode) query['itemCode'] = filters.itemCode;
    if (filters.variantCode) query['variantCode'] = filters.variantCode;
    return query;
}

/** Llamadas del panel de administración de un evento. */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
    private api = inject(ApiV2Service);
    private http = inject(HttpClient);

    report(eventId: number): Observable<EventReport> {
        return this.api.get(`/events/${eventId}/report`);
    }

    activity(eventId: number, after?: number): Observable<{ items: ActivityItem[]; cursor: number }> {
        return this.api.get(`/events/${eventId}/activity`, { after });
    }

    registrations(eventId: number, filters: RegistrationFilters, paging: {
        page: number; pageSize: number; sort: RegistrationSort; order: 'asc' | 'desc';
    }): Observable<Page<RegistrationListItem>> {
        return this.api.get(`/events/${eventId}/registrations`, registrationQuery(filters, paging));
    }

    /** CSV con los mismos filtros (descarga con el token de la sesión). */
    exportCsv(eventId: number, filters: RegistrationFilters, locale: Locale): Observable<Blob> {
        let params = new HttpParams().set('locale', locale);
        for (const [k, v] of Object.entries(registrationQuery(filters, { page: 1, pageSize: 1, sort: 'created_at', order: 'desc' }))) {
            if (!['page', 'pageSize', 'sort', 'order'].includes(k)) params = params.set(k, String(v));
        }
        return this.http.get(`${API_V2}/events/${eventId}/registrations/export`, { params, responseType: 'blob' }).pipe(
            catchError(e => throwError(() => toApiError(e))),
        );
    }

    checkinLookup(eventId: number, publicCode: string): Observable<CheckinSummary> {
        return this.api.get('/events/' + eventId + '/checkin/' + publicCode);
    }

    checkinByCode(eventId: number, publicCode: string): Observable<CheckinResult> {
        return this.api.post('/events/' + eventId + '/checkin', { publicCode });
    }

    registration(id: number, includeDeleted = false): Observable<RegistrationDetail> {
        return this.api.get(`/registrations/${id}`, { includeDeleted: includeDeleted || undefined });
    }

    updateRegistration(id: number, changes: RegistrationUpdate): Observable<RegistrationDetail> {
        return this.api.patch(`/registrations/${id}`, changes);
    }

    deleteRegistration(id: number, reason: string | null): Observable<unknown> {
        return this.api.delete(`/registrations/${id}`, { reason });
    }

    restoreRegistration(id: number): Observable<RegistrationDetail> {
        return this.api.post(`/registrations/${id}/restore`);
    }

    checkIn(id: number): Observable<RegistrationDetail> {
        return this.api.post(`/registrations/${id}/checkin`);
    }

    undoCheckIn(id: number): Observable<RegistrationDetail> {
        return this.api.delete(`/registrations/${id}/checkin`);
    }

    setDelivered(registrationId: number, itemId: number, delivered: boolean): Observable<RegistrationDetail> {
        const path = `/registrations/${registrationId}/items/${itemId}/delivery`;
        return delivered ? this.api.post(path) : this.api.delete(path);
    }

    changeVariant(registrationId: number, itemId: number, variantCode: string): Observable<RegistrationDetail> {
        return this.api.patch(`/registrations/${registrationId}/items/${itemId}`, { variantCode });
    }

    history(registrationId: number): Observable<AuditEntry[]> {
        return this.api.get(`/registrations/${registrationId}/history`);
    }

    // ── Pagos ──

    eventPayments(eventId: number, filters: PaymentFilters, page: number, pageSize: number): Observable<EventPaymentsPage> {
        return this.api.get('/events/' + eventId + '/payments', { page, pageSize, method: filters.method, status: filters.status });
    }

    recordPayment(registrationId: number, input: ManualPaymentInput): Observable<unknown> {
        return this.api.post('/registrations/' + registrationId + '/payments', input);
    }

    voidPayment(paymentId: number, reason: string): Observable<unknown> {
        return this.api.post('/payments/' + paymentId + '/void', { reason });
    }

    refundPayment(paymentId: number, reason: string, amountCents?: number): Observable<unknown> {
        return this.api.post('/payments/' + paymentId + '/refund', { reason, ...(amountCents ? { amountCents } : {}) });
    }

    // ── Auditoría ──

    audit(filters: AuditFilters, page: number, pageSize: number): Observable<Page<AuditEntry>> {
        return this.api.get('/audit', { page, pageSize, eventId: filters.eventId, entityType: filters.entityType, action: filters.action,
            actorUserId: filters.actorUserId, from: filters.from, to: filters.to });
    }

    members(): Observable<Member[]> {
        return this.api.get('/users');
    }

    private tree$?: Observable<OrgNode | null>;

    /** Árbol de organizaciones; se pide una sola vez por sesión de la pantalla. */
    organizationTree(): Observable<OrgNode | null> {
        return this.tree$ ??= this.api.get<OrgNode | null>('/organizations/tree').pipe(shareReplay(1));
    }

    /** Productos y tallas del formulario (para cambiar la talla de un registro). */
    formItems(formId: number): Observable<FormItemsView> {
        return this.api.get(`/forms/${formId}`);
    }
}

/** Asociaciones (conference) de un árbol de organizaciones, en orden alfabético. */
export function conferencesOf(root: OrgNode | null): OrgNode[] {
    const out: OrgNode[] = [];
    const walk = (node: OrgNode) => {
        if (node.type === 'conference') out.push(node);
        node.children.forEach(walk);
    };
    if (root) walk(root);
    return out.sort((a, b) => a.name.localeCompare(b.name));
}
