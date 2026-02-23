
import React, { useState } from 'react';
import { Organization, PlanType, User, UserRole } from '../types';
import { db } from '../lib/supabase';
import { Building2, Mail, User as UserIcon, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

interface RegistrationFormProps {
  onSuccess: (orgId: string) => void;
  onBack: () => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ onSuccess, onBack }) => {
  const [step, setStep] = useState<'org' | 'success'>('org');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    orgName: '',
    email: '',
    adminName: '',
    adminPin: '0000'
  });
  const [generatedOrgId, setGeneratedOrgId] = useState('');

  const generateOrgId = (name: string) => {
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10);
    const random = Math.random().toString(36).substring(2, 6);
    return `${slug}_${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Generate a unique org ID
      let orgId = generateOrgId(formData.orgName);
      let attempts = 0;
      let isUnique = false;
      
      while (!isUnique && attempts < 5) {
        const existingOrg = await db.getOrganization(orgId);
        if (!existingOrg) {
          isUnique = true;
        } else {
          orgId = generateOrgId(formData.orgName);
          attempts++;
        }
      }

      if (!isUnique) {
        setError('Не удалось создать уникальный ID. Попробуйте другое название.');
        setLoading(false);
        return;
      }

      setGeneratedOrgId(orgId);

      // 2. Create Organization
      const newOrg: Organization = {
        id: orgId,
        name: formData.orgName,
        email: formData.email,
        ownerId: 'admin',
        plan: PlanType.FREE,
        status: 'active'
      };

      await db.createOrganization(newOrg);

      // 3. Create Admin User
      const adminUser: User = {
        id: 'admin',
        name: formData.adminName,
        role: UserRole.EMPLOYER,
        position: 'Администратор',
        pin: formData.adminPin,
        isAdmin: true,
        organizationId: orgId
      };

      await db.upsertUser(adminUser, orgId);

      setStep('success');
    } catch (err: any) {
      setError('Произошла ошибка при регистрации: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 p-10 w-full max-w-md text-center space-y-6 animate-fadeIn">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-50">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Готово!</h2>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Организация <span className="font-bold text-slate-900">{formData.orgName}</span> успешно создана. 
              Теперь вы можете войти в систему, используя ID организации и ваш PIN.
            </p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400 uppercase">ID организации:</span>
              <code className="text-blue-600">{generatedOrgId}</code>
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400 uppercase">Ваш PIN:</span>
              <code className="text-blue-600">{formData.adminPin}</code>
            </div>
          </div>
          <button 
            onClick={() => onSuccess(generatedOrgId)}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Войти в систему
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 p-8 w-full max-w-md relative overflow-hidden">
        <button 
          onClick={onBack}
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-900 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>

        <div className="text-center mb-8">
          <div className="bg-blue-600 text-white p-4 rounded-3xl inline-block mb-4 shadow-xl shadow-blue-100">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Регистрация</h1>
          <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-widest">Создайте аккаунт для вашей компании</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1.5 tracking-wider">Название компании</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  required
                  value={formData.orgName}
                  onChange={e => setFormData({ ...formData, orgName: e.target.value })}
                  placeholder="ООО 'Вектор'"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-11 pr-5 py-3.5 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1.5 tracking-wider">Email владельца</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@company.com"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-11 pr-5 py-3.5 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1.5 tracking-wider">Имя администратора</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  required
                  value={formData.adminName}
                  onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                  placeholder="Иван Иванов"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-11 pr-5 py-3.5 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1.5 tracking-wider">PIN-код администратора (4 цифры)</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  required
                  maxLength={4}
                  value={formData.adminPin}
                  onChange={e => setFormData({ ...formData, adminPin: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="0000"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-11 pr-5 py-3.5 text-lg font-black tracking-[0.5em] focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-bold uppercase text-center">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Создание...' : 'Зарегистрироваться'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegistrationForm;
