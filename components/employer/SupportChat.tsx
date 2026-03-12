import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, MessageSquare, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SupportMessage, User, UserRole } from '../../types';

interface SupportChatProps {
  currentUser: User | null;
  orgId: string;
}

export const SupportChat: React.FC<SupportChatProps> = ({ currentUser, orgId }) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [orgNames, setOrgNames] = useState<Record<string, string>>({});

  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    const fetchOrgNames = async () => {
      if (!isSuperAdmin) return;
      const { data } = await supabase.from('organizations').select('id, name');
      if (data) {
        const names: Record<string, string> = {};
        data.forEach(org => {
          names[org.id] = org.name;
        });
        setOrgNames(names);
      }
    };
    fetchOrgNames();
  }, [isSuperAdmin]);

  useEffect(() => {
    const fetchMessages = async () => {
      setMessages([]); // Clear messages when orgId changes
      if (!isSuperAdmin && !orgId) {
        return;
      }
      let query = supabase.from('support_messages').select('*').order('created_at', { ascending: true });
      
      // If not global admin, only show messages for this org
      if (!isSuperAdmin) {
        query = query.eq('organization_id', orgId);
      }
      
      const { data, error } = await query;
      if (data) {
        setMessages(data.map((m: any) => ({
          id: m.id,
          senderId: m.sender_id,
          senderName: m.sender_name,
          organizationId: m.organization_id,
          message: m.message,
          createdAt: m.created_at
        })));
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`support_chat_${orgId || 'admin'}_${Date.now()}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'support_messages' 
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          console.log('📩 New support message received:', payload.new);
          const newMessage = payload.new;
          if (isSuperAdmin || newMessage.organization_id === orgId) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, {
                id: newMessage.id,
                senderId: newMessage.sender_id,
                senderName: newMessage.sender_name,
                organizationId: newMessage.organization_id,
                message: newMessage.message,
                createdAt: newMessage.created_at
              }];
            });
          }
        }
      })
      .subscribe((status) => {
        console.log('🔌 Support chat subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up support chat subscription');
      supabase.removeChannel(channel);
    };
  }, [currentUser, orgId, isSuperAdmin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedOrgId]);

  const filteredMessages = useMemo(() => {
    if (!isSuperAdmin || selectedOrgId === 'all') return messages;
    return messages.filter(m => m.organizationId === selectedOrgId);
  }, [messages, selectedOrgId, isSuperAdmin]);

  const uniqueOrgs = useMemo(() => {
    const orgs = Array.from(new Set(messages.map(m => m.organizationId)));
    return orgs;
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    // If super admin is sending a message, use the selected org, otherwise use current org
    const targetOrgId = (isSuperAdmin && selectedOrgId !== 'all') ? selectedOrgId : orgId;

    if (!targetOrgId) {
      alert('Ошибка: не выбрана организация');
      return;
    }

    const { error } = await supabase.from('support_messages').insert({
      sender_id: currentUser.id,
      sender_name: isSuperAdmin ? 'Техподдержка' : currentUser.name,
      organization_id: targetOrgId,
      message: newMessage.trim(),
      created_at: new Date().toISOString()
    });

    if (!error) {
      setNewMessage('');
    } else {
      alert('Ошибка при отправке сообщения');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="text-indigo-600" />
          <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Чат с техподдержкой</h3>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select 
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none"
            >
              <option value="all">Все организации</option>
              {uniqueOrgs.map(id => (
                <option key={id} value={id}>{orgNames[id] || id}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isSuperAdmin && selectedOrgId === 'all' && messages.length > 0 && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-100 text-[10px] text-amber-700 font-bold text-center">
            💡 Нажмите на сообщение пользователя, чтобы выбрать организацию для ответа
          </div>
        )}
        {filteredMessages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.senderId === currentUser?.id ? 'items-end' : 'items-start'}`}>
            <span className="text-[10px] font-bold text-slate-400 mb-1">
              {m.senderName} {isSuperAdmin && `(${orgNames[m.organizationId] || m.organizationId})`}
            </span>
            <div 
              onClick={() => {
                if (isSuperAdmin && m.organizationId) {
                  setSelectedOrgId(m.organizationId);
                }
              }}
              className={`p-3 rounded-2xl max-w-[80%] cursor-pointer transition-all ${
                m.senderName === 'Техподдержка' || m.senderId === currentUser?.id
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
              }`}
            >
              {m.message}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder={
            !currentUser ? "Войдите, чтобы написать..." :
            isSuperAdmin && selectedOrgId === 'all' ? "Выберите организацию для ответа..." : 
            !isSuperAdmin && !orgId ? "Ошибка: организация не определена" :
            "Ваше сообщение..."
          }
          disabled={!currentUser || (isSuperAdmin && selectedOrgId === 'all') || (!isSuperAdmin && !orgId)}
          className="flex-1 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50"
        />
        <button 
          type="submit" 
          className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95" 
          disabled={!currentUser || (isSuperAdmin && selectedOrgId === 'all') || (!isSuperAdmin && !orgId)}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};
