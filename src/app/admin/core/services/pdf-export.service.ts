import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportFilters {
  conferencia: string;
  checkin: string;
  busqueda: string;
  iglesia?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {

  exportParticipantsReport(
    rows: (string | number)[][],
    filters: ReportFilters
  ): void {

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    // =========================================================
    // HEADER - SOLO PRIMERA PÁGINA
    // =========================================================

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(33, 37, 41);

    doc.text(
      'PARTICIPANTES REGISTRADOS',
      14,
      16
    );

    // =========================================================
    // FILTROS
    // =========================================================

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(33, 37, 41);

    doc.text(
      'Filtros aplicados:',
      14,
      25
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);

    const conferencia =
      filters.conferencia?.trim() || 'Todas las conferencias';

    const checkin =
      filters.checkin?.trim() || 'Todos los check-in';

    const busqueda =
      filters.busqueda?.trim() || 'Sin búsqueda';

    const iglesia =
      filters.iglesia?.trim() || 'Todas las iglesias';

    doc.text(
      `Conferencia: ${conferencia}`,
      14,
      31
    );

    doc.text(
      `Iglesia: ${iglesia}`,
      14,
      37
    );

    doc.text(
      `Check-in: ${checkin}`,
      14,
      43
    );

    doc.text(
      `Búsqueda: ${busqueda}`,
      14,
      49
    );

    // =========================================================
    // INFORMACIÓN DEL REPORTE
    // =========================================================

    const fechaGeneracion = new Date().toLocaleString(
      'es-ES',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(33, 37, 41);

    doc.text(
      `Total encontrados: ${rows.length}`,
      14,
      57
    );

    doc.text(
      `Generado: ${fechaGeneracion}`,
      pageWidth - 14,
      57,
      {
        align: 'right'
      }
    );

    // =========================================================
    // LÍNEA SEPARADORA
    // =========================================================

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.4);

    doc.line(
      14,
      62,
      pageWidth - 14,
      62
    );

    // =========================================================
    // TABLA
    // =========================================================

    const headers = [
      'NOº',
      'Nombre',
      'Teléfono',
      'Iglesia',
      'Conferencia',
      'Estado',
      'Check-in',
      'Registro'
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,

      // Primera página empieza después del header
      startY: 67,

      theme: 'striped',

      margin: {
        top: 12,
        right: 14,
        bottom: 18,
        left: 14
      },

      // IMPORTANTE:
      // Esto permite controlar el margen superior de cada página.
      pageBreak: 'auto',

      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 2.2,
        textColor: [50, 50, 50],
        lineColor: [225, 225, 225],
        lineWidth: 0.2,
        valign: 'middle'
      },

      headStyles: {
        fillColor: [239, 201, 112],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5
      },

      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },

      columnStyles: {
        0: {
          cellWidth: 12,
          halign: 'center'
        },

        1: {
          cellWidth: 40
        },

        2: {
          cellWidth: 28
        },

        3: {
          cellWidth: 45
        },

        4: {
          cellWidth: 50
        },

        5: {
          cellWidth: 30
        },

        6: {
          cellWidth: 28,
          halign: 'center'
        },

        7: {
          cellWidth: 28,
          halign: 'center'
        }
      },

      // =======================================================
      // CONTROL DEL SALTO DE PÁGINA
      // =======================================================

      didDrawPage: (data) => {

        // Si estamos en páginas posteriores,
        // NO dibujamos el header del reporte.
        if (data.pageNumber > 1) {
          return;
        }
      }
    });

    // =========================================================
    // FOOTER
    // =========================================================

    const totalPages = doc.getNumberOfPages();

    for (let page = 1; page <= totalPages; page++) {

      doc.setPage(page);

      const pageHeight =
        doc.internal.pageSize.getHeight();

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);

      doc.text(
        'Reporte de participantes',
        14,
        pageHeight - 8
      );

      doc.text(
        `Página ${page} de ${totalPages}`,
        pageWidth - 14,
        pageHeight - 8,
        {
          align: 'right'
        }
      );
    }

    // =========================================================
    // DESCARGA
    // =========================================================

    doc.save('Registro-participantes.pdf');
  }
}
