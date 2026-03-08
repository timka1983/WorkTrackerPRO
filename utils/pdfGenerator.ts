import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export const generatePayslipPDF = async (employee: any, payroll: any, month: string) => {
  // Create a temporary hidden element for rendering
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.padding = '40px';
  container.style.backgroundColor = 'white';
  container.style.fontFamily = 'Arial, sans-serif';
  
  const monthName = format(new Date(month), 'MMMM yyyy', { locale: ru });
  
  container.innerHTML = `
    <div style="border: 2px solid #334155; padding: 30px; border-radius: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="margin: 0; color: #1e293b; font-size: 24px;">Расчетный листок</h1>
        <div style="text-align: right;">
          <p style="margin: 0; color: #64748b; font-size: 14px;">Период: <strong>${monthName}</strong></p>
        </div>
      </div>
      
      <div style="margin-bottom: 30px;">
        <p style="margin: 5px 0; color: #64748b; font-size: 14px;">Сотрудник: <strong style="color: #1e293b; font-size: 18px;">${employee.name}</strong></p>
        <p style="margin: 5px 0; color: #64748b; font-size: 14px;">Должность: <strong style="color: #1e293b;">${employee.position}</strong></p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
            <th style="text-align: left; padding: 12px; color: #475569; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Начисление</th>
            <th style="text-align: right; padding: 12px; color: #475569; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Сумма (₽)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; color: #334155; font-size: 14px;">Основная зарплата</td>
            <td style="padding: 12px; text-align: right; color: #334155; font-size: 14px; font-weight: bold;">${(payroll?.regularPay ?? 0).toLocaleString('ru-RU')}</td>
          </tr>
          ${payroll?.overtimePay > 0 ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; color: #334155; font-size: 14px;">Сверхурочные</td>
            <td style="padding: 12px; text-align: right; color: #334155; font-size: 14px; font-weight: bold;">${payroll.overtimePay.toLocaleString('ru-RU')}</td>
          </tr>` : ''}
          ${payroll?.nightShiftPay > 0 ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; color: #334155; font-size: 14px;">Ночные смены</td>
            <td style="padding: 12px; text-align: right; color: #334155; font-size: 14px; font-weight: bold;">${payroll.nightShiftPay.toLocaleString('ru-RU')}</td>
          </tr>` : ''}
          ${payroll?.sickLeavePay > 0 ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; color: #334155; font-size: 14px;">Больничные</td>
            <td style="padding: 12px; text-align: right; color: #334155; font-size: 14px; font-weight: bold;">${payroll.sickLeavePay.toLocaleString('ru-RU')}</td>
          </tr>` : ''}
          ${payroll?.bonuses > 0 ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; color: #334155; font-size: 14px;">Премии</td>
            <td style="padding: 12px; text-align: right; color: #16a34a; font-size: 14px; font-weight: bold;">+${payroll.bonuses.toLocaleString('ru-RU')}</td>
          </tr>` : ''}
          ${payroll?.fines > 0 ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; color: #334155; font-size: 14px;">Штрафы</td>
            <td style="padding: 12px; text-align: right; color: #dc2626; font-size: 14px; font-weight: bold;">-${payroll.fines.toLocaleString('ru-RU')}</td>
          </tr>` : ''}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8fafc; border-top: 2px solid #e2e8f0;">
            <td style="padding: 16px 12px; color: #1e293b; font-size: 18px; font-weight: 900; text-transform: uppercase;">Итого к выплате</td>
            <td style="padding: 16px 12px; text-align: right; color: #1e293b; font-size: 20px; font-weight: 900;">${(payroll?.totalSalary ?? 0).toLocaleString('ru-RU')} ₽</td>
          </tr>
        </tfoot>
      </table>
      
      <div style="margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">
        Сформировано в системе Work Tracker Pro • ${format(new Date(), 'dd.MM.yyyy HH:mm')}
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
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Payslip_${employee.name}_${month}.pdf`);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
  } finally {
    document.body.removeChild(container);
  }
};
