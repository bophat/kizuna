import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, Globe, ShoppingCart, MessageCircle, CheckCheck, Trash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../contexts/NotificationContext';
import { useChatbot } from '../contexts/ChatbotContext';
import { useSettings } from '../hooks/useSettings';

export function TopBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enabled: chatbotEnabled } = useChatbot();
  const { notifications, unreadCount, liveSync, markAsRead, markAllAsRead, clearNotification } =
    useNotification();
  const { settings } = useSettings();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const publicSiteUrl = settings['PUBLIC_SITE_URL'] || 'http://localhost:3000';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-20 bg-white border-b border-brand-clay flex items-center justify-between px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/30" />
          <input 
            type="text" 
            placeholder={t('common.search')}
            className="w-full pl-11 pr-4 py-2.5 bg-brand-paper border border-brand-clay rounded-lg text-sm focus:outline-none focus:border-brand-red/30 transition-all placeholder:text-brand-ink/30"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <a 
          href={publicSiteUrl}
          target="_blank" 
          rel="noopener noreferrer"
          className="hidden lg:flex items-center gap-2 text-xs font-semibold text-brand-ink/60 hover:text-brand-red transition-colors uppercase tracking-wider"
        >
          <Globe size={14} />
          <span>{t('common.view_public')}</span>
        </a>

        <div className="h-8 w-px bg-brand-clay hidden lg:block" />

        <LanguageSwitcher />

        <div className="relative" ref={notificationRef}>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 text-brand-ink/60 hover:text-brand-red hover:bg-brand-paper rounded-full transition-all"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-brand-red rounded-full border-2 border-white animate-pulse"></span>
            )}
          </motion.button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-brand-clay overflow-hidden z-50"
              >
                <div className="p-4 border-b border-brand-clay flex items-center justify-between bg-brand-paper/50">
                  <h3 className="font-semibold text-sm text-brand-ink">{t('notifications.title')}</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs text-brand-red hover:text-brand-red/80 flex items-center gap-1 transition-colors"
                    >
                      <CheckCheck size={14} />
                      {t('notifications.mark_all_read')}
                    </button>
                  )}
                </div>

                {!chatbotEnabled && (
                  <p className="px-4 py-2 text-[10px] text-brand-ink/50 bg-amber-50 border-b border-amber-100 leading-relaxed">
                    Tin Concierge website &amp; đơn hàng: cập nhật ~20s. Bật AI/Flask trong Settings để bot tự trả lời.
                  </p>
                )}
                {chatbotEnabled && liveSync && (
                  <p className="px-4 py-1.5 text-[10px] text-green-700/80 bg-green-50 border-b border-green-100">
                    Live sync đang bật
                  </p>
                )}
                
                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-brand-ink/40 text-sm">
                      {t('notifications.empty')}
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-brand-clay">
                      {notifications.map(notification => (
                        <div 
                          key={notification.id} 
                          className={`p-4 flex gap-3 transition-colors hover:bg-brand-paper/50 cursor-pointer ${notification.read ? 'opacity-70' : 'bg-brand-red/5'}`}
                          onClick={() => {
                            if (!notification.read) markAsRead(notification.id);
                            setShowNotifications(false);
                            if (notification.type === 'ORDER') {
                              navigate('/orders');
                            } else if (notification.type === 'CHAT') {
                              navigate(
                                notification.id.startsWith('approval_') ? '/approvals' : '/chat'
                              );
                            }
                          }}
                        >
                          <div className={`mt-0.5 p-2 rounded-full h-fit ${notification.type === 'ORDER' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                            {notification.type === 'ORDER' ? <ShoppingCart size={16} /> : <MessageCircle size={16} />}
                          </div>
                          <div className="flex-1">
                            <h4 className={`text-sm font-medium ${!notification.read ? 'text-brand-ink' : 'text-brand-ink/70'}`}>
                              {notification.title}
                            </h4>
                            <p className="text-xs text-brand-ink/60 mt-1 whitespace-pre-wrap">
                              {notification.message}
                            </p>
                            <span className="text-[10px] text-brand-ink/40 mt-2 block">
                              {new Date(notification.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              clearNotification(notification.id);
                            }}
                            className="text-brand-ink/30 hover:text-brand-red transition-colors h-fit p-1"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
