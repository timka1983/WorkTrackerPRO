import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, MessageSquare, Filter, Search, ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SupportMessage, User, UserRole } from '../../types';

interface SupportChatProps {
  currentUser: User | null;
  orgId: string;
  onOrgSelect?: (orgId: string) => void;
  unreadByOrg?: Record<string, number>;
}

export const SupportChat: React.FC<SupportChatProps> = ({ currentUser, orgId, onOrgSelect, unreadByOrg = {} }) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [orgSearchTerm, setOrgSearchTerm] = useState('');
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
      
      let query = supabase.from('support_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      // If not global admin, only show messages for this org
      if (!isSuperAdmin) {
        query = query.eq('organization_id', orgId);
      } else if (selectedOrgId !== 'all') {
        query = query.eq('organization_id', selectedOrgId);
      }
      
      const { data, error } = await query;
      if (data) {
        setMessages(data.reverse().map((m: any) => ({
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

    let filter = undefined;
    if (!isSuperAdmin) {
      filter = `organization_id=eq.${orgId}`;
    } else if (selectedOrgId !== 'all') {
      filter = `organization_id=eq.${selectedOrgId}`;
    }

    const channel = supabase
      .channel(`support_chat_${orgId || 'admin'}_${selectedOrgId}_${Date.now()}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'support_messages',
        filter: filter
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          console.log('📩 New support message received:', payload.new);
          const newMessage = payload.new;
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
      })
      .subscribe((status) => {
        console.log('🔌 Support chat subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up support chat subscription');
      supabase.removeChannel(channel);
    };
  }, [currentUser, orgId, isSuperAdmin, selectedOrgId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedOrgId]);

  const filteredMessages = useMemo(() => {
    if (!isSuperAdmin || selectedOrgId === 'all') return messages;
    return messages.filter(m => m.organizationId === selectedOrgId);
  }, [messages, selectedOrgId, isSuperAdmin]);

  const filteredOrgs = useMemo(() => {
    if (!isSuperAdmin) return [];
    
    // Sort organizations: those with unread messages first, then alphabetically
    const sortedOrgs = Object.entries(orgNames).sort(([idA, nameA], [idB, nameB]) => {
      const unreadA = unreadByOrg[idA] || 0;
      const unreadB = unreadByOrg[idB] || 0;
      if (unreadA !== unreadB) {
        return unreadB - unreadA; // Descending unread count
      }
      return nameA.localeCompare(nameB);
    });

    if (!orgSearchTerm.trim()) return sortedOrgs;

    const term = orgSearchTerm.toLowerCase();
    return sortedOrgs.filter(([id, name]) => name.toLowerCase().includes(term));
  }, [orgNames, orgSearchTerm, isSuperAdmin, unreadByOrg]);

  useEffect(() => {
    if (onOrgSelect) {
      if (isSuperAdmin && selectedOrgId !== 'all') {
        onOrgSelect(selectedOrgId);
      } else if (!isSuperAdmin && orgId) {
        onOrgSelect(orgId);
      }
    }
  }, [selectedOrgId, orgId, isSuperAdmin, onOrgSelect, messages.length]);

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
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 flex flex-col h-[600px]">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSuperAdmin && selectedOrgId !== 'all' ? (
            <button 
              onClick={() => setSelectedOrgId('all')}
              className="p-1.5 bg-slate-100 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
          ) : (
            <MessageSquare className="text-indigo-600 dark:text-indigo-400" />
          )}
          <h3 className="font-bold text-slate-900 dark:text-slate-50 uppercase text-xs tracking-widest">
            {isSuperAdmin && selectedOrgId !== 'all' 
              ? `Чат: ${orgNames[selectedOrgId] || selectedOrgId}` 
              : 'Чат с техподдержкой'}
          </h3>
        </div>
      </div>

      {isSuperAdmin && selectedOrgId === 'all' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={orgSearchTerm}
                onChange={(e) => setOrgSearchTerm(e.target.value)}
                placeholder="Поиск организации..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-500 transition-colors text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredOrgs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Организации не найдены
              </div>
            ) : (
              <div className="space-y-1">
                {filteredOrgs.map(([id, name]) => {
                  const unreadCount = unreadByOrg[id] || 0;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedOrgId(id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left text-slate-900 dark:text-slate-100"
                    >
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate pr-4">{name}</span>
                      {unreadCount > 0 && (
                        <span className="flex-shrink-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {filteredMessages.map(m => {
              const isOwnMessage = m.senderId === currentUser?.id;
              // Support messages are those from 'Техподдержка' or sent by any admin/super-admin
              const isSupportMessage = 
                m.senderName === 'Техподдержка' || 
                m.senderId === 'admin' || 
                m.senderId === 'super-admin' ||
                (isSuperAdmin && isOwnMessage); // For super admin, their own messages are support messages
              
              // For a regular employer, support messages should be Emerald
              // For a super admin, their own messages are Indigo, and client messages are Blue/Slate
              const bgColor = isOwnMessage 
                ? '#4f46e5' // Indigo for own
                : (isSupportMessage ? '#10b981' : (isSuperAdmin ? '#dbeafe' : '#f1f5f9'));
              
              const textColor = (isOwnMessage || (isSupportMessage && !isSuperAdmin)) 
                ? '#ffffff' 
                : (isSuperAdmin && !isOwnMessage ? '#1e3a8a' : '#0f172a');

              return (
                <div key={m.id} className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] font-bold text-slate-400 mb-1">
                    {m.senderName} {isSuperAdmin && `(${orgNames[m.organizationId] || m.organizationId})`}
                  </span>
                  <div 
                    className="p-3 rounded-2xl max-w-[80%] transition-all shadow-md dark:shadow-slate-900/20 border"
                    style={{ 
                      wordBreak: 'break-word',
                      backgroundColor: bgColor,
                      color: textColor,
                      borderColor: isOwnMessage ? '#4338ca' : (isSupportMessage ? '#059669' : '#e2e8f0')
                    }}
                  >
                    {m.message}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder={
                !currentUser ? "Войдите, чтобы написать..." :
                !isSuperAdmin && !orgId ? "Ошибка: организация не определена" :
                "Ваше сообщение..."
              }
              disabled={!currentUser || (!isSuperAdmin && !orgId)}
              className="flex-1 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
            <button 
              type="submit" 
              className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95" 
              disabled={!currentUser || (!isSuperAdmin && !orgId)}
            >
              <Send size={20} />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
