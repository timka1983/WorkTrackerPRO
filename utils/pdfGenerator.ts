import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export const generatePayslipPDF = async (employee: any, payroll: any, month: string, payments: any[] = [], machines: any[] = []) => {
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
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = (payroll?.totalSalary ?? 0) - totalPaid;

  const formatMinsToHHMM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}.${m.toString().padStart(2, '0')}`;
  };
  
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
          ${Object.entries(payroll?.machineEarnings || {}).map(([mId, data]: [string, any]) => {
            const m = machines.find(x => x.id === mId);
            if (!m) return '';
            return `
              <tr style="border-bottom: 1px solid #f1f5f9; background-color: #fcfcfc;">
                <td style="padding: 8px 12px 8px 30px; color: #64748b; font-size: 12px; font-style: italic;">↳ ${m.name} (${formatMinsToHHMM(data.mins)} ч.)</td>
                <td style="padding: 8px 12px; text-align: right; color: #64748b; font-size: 12px; font-weight: bold;">${Math.round(data.pay).toLocaleString('ru-RU')}</td>
              </tr>
            `;
          }).join('')}
          ${payroll?.overtimePay > 0 ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; color: #334155; font-size: 14px;">Сверхурочные (${payroll.details.overtimeHours} ч.)</td>
            <td style="padding: 12px; text-align: right; color: #334155; font-size: 14px; font-weight: bold;">${payroll.overtimePay.toLocaleString('ru-RU')}</td>
          </tr>` : ''}
          ${payroll?.nightShiftPay > 0 ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; color: #334155; font-size: 14px;">Ночные смены (${payroll.details.nightShiftCount})</td>
            <td style="padding: 12px; text-align: right; color: #334155; font-size: 14px; font-weight: bold;">${payroll.nightShiftPay.toLocaleString('ru-RU')}</td>
          </tr>` : ''}
          ${payroll?.sickLeavePay > 0 ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; color: #334155; font-size: 14px;">Больничные (${payroll.details.sickDays} дн.)</td>
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
            <td style="padding: 16px 12px; color: #1e293b; font-size: 16px; font-weight: 900; text-transform: uppercase;">Начислено всего</td>
            <td style="padding: 16px 12px; text-align: right; color: #1e293b; font-size: 18px; font-weight: 900;">${(payroll?.totalSalary ?? 0).toLocaleString('ru-RU')} ₽</td>
          </tr>
        </tfoot>
      </table>

      ${payments.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
            <th style="text-align: left; padding: 12px; color: #475569; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Выплаты и авансы</th>
            <th style="text-align: right; padding: 12px; color: #475569; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Сумма (₽)</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map(p => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px; color: #334155; font-size: 14px;">
                ${p.type === 'advance' ? 'Аванс' : p.type === 'salary' ? 'Зарплата' : p.type === 'bonus' ? 'Премия' : 'Прочее'} 
                <span style="color: #94a3b8; font-size: 12px;">(${format(new Date(p.date), 'dd.MM.yyyy')})</span>
                ${p.comment ? `<br/><span style="color: #94a3b8; font-size: 11px;">${p.comment}</span>` : ''}
              </td>
              <td style="padding: 12px; text-align: right; color: #334155; font-size: 14px; font-weight: bold;">${p.amount.toLocaleString('ru-RU')}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8fafc; border-top: 2px solid #e2e8f0;">
            <td style="padding: 16px 12px; color: #1e293b; font-size: 16px; font-weight: 900; text-transform: uppercase;">Выплачено всего</td>
            <td style="padding: 16px 12px; text-align: right; color: #1e293b; font-size: 18px; font-weight: 900;">${totalPaid.toLocaleString('ru-RU')} ₽</td>
          </tr>
          <tr style="background-color: ${balance > 0 ? '#f0fdf4' : '#fef2f2'};">
            <td style="padding: 16px 12px; color: ${balance > 0 ? '#166534' : '#991b1b'}; font-size: 18px; font-weight: 900; text-transform: uppercase;">Остаток к выплате</td>
            <td style="padding: 16px 12px; text-align: right; color: ${balance > 0 ? '#166534' : '#991b1b'}; font-size: 20px; font-weight: 900;">${balance.toLocaleString('ru-RU')} ₽</td>
          </tr>
        </tfoot>
      </table>
      ` : ''}
      
      <div style="margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">
        Сформировано в системе Work Tracker Pro v2.1 • ${format(new Date(), 'dd.MM.yyyy HH:mm')}
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
