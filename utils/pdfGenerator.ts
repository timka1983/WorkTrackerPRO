import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export const generatePayslipPDF = async (employee: any, payroll: any, month: string, payments: any[] = [], machines: any[] = []) => {
  // ... (existing code)
};

export const generatePayrollReportPDF = async (payrollData: any[], month: string) => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px'; // A4 width approx
  container.style.padding = '20px';
  container.style.backgroundColor = 'white';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.fontSize = '10px'; // Smaller font

  const monthName = format(new Date(month), 'MMMM yyyy', { locale: ru });

  container.innerHTML = `
    <div style="padding: 10px;">
      <h2 style="text-align: center; color: #1e293b; margin-bottom: 15px; font-size: 20px; font-weight: bold;">Ведомость по зарплате: ${monthName}</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #334155;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #334155;">
            <th style="text-align: left; padding: 6px; border: 1px solid #334155; width: 20%;">Сотрудник</th>
            <th style="text-align: left; padding: 6px; border: 1px solid #334155; width: 15%;">Должность</th>
            <th style="text-align: center; padding: 6px; border: 1px solid #334155;">Часы</th>
            <th style="text-align: center; padding: 6px; border: 1px solid #334155;">Б/л</th>
            <th style="text-align: center; padding: 6px; border: 1px solid #334155;">Аванс</th>
            <th style="text-align: center; padding: 6px; border: 1px solid #334155;">Премия</th>
            <th style="text-align: right; padding: 6px; border: 1px solid #334155;">Начислено</th>
            <th style="text-align: right; padding: 6px; border: 1px solid #334155;">Выдано</th>
            <th style="text-align: right; padding: 6px; border: 1px solid #334155;">Получил</th>
            <th style="text-align: right; padding: 6px; border: 1px solid #334155;">Остаток</th>
          </tr>
        </thead>
        <tbody>
          ${payrollData.map(p => `
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 4px 6px; border: 1px solid #334155;">${p.employeeName}</td>
              <td style="padding: 4px 6px; border: 1px solid #334155;">${p.position}</td>
              <td style="padding: 4px 6px; text-align: center; border: 1px solid #334155;">${p.totalHours || ''}</td>
              <td style="padding: 4px 6px; text-align: center; border: 1px solid #334155;">${p.sickDays || ''}</td>
              <td style="padding: 4px 6px; text-align: center; border: 1px solid #334155;">${p.advance || ''}</td>
              <td style="padding: 4px 6px; text-align: center; border: 1px solid #334155;">${p.bonus || ''}</td>
              <td style="padding: 4px 6px; text-align: right; border: 1px solid #334155;">${p.totalSalary.toLocaleString('ru-RU')}</td>
              <td style="padding: 4px 6px; text-align: right; border: 1px solid #334155;"></td>
              <td style="padding: 4px 6px; text-align: right; border: 1px solid #334155;"></td>
              <td style="padding: 4px 6px; text-align: right; border: 1px solid #334155;"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top: 10px; text-align: right; color: #64748b; font-size: 9px;">
        Сформировано: ${format(new Date(), 'dd.MM.yyyy HH:mm')}
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: 'white'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait orientation
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Payroll_Report_${month}.pdf`);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
  } finally {
    document.body.removeChild(container);
  }
};
