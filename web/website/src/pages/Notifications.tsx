import { Icons } from '@/components/Icons';
import { NOTIFICATIONS } from '@/constants';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

export function NotificationsPage() {
  return (
    <div className="max-w-[768px] mx-auto px-4 md:px-8 py-12 md:py-16">
      <div className="mb-12">
        <h1 className="headline-xl">Notifications</h1>
      </div>

      <div className="flex flex-col gap-6">
        {NOTIFICATIONS.map((notif, idx) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`
              relative p-8 rounded-sm border border-surface-variant flex flex-col md:flex-row gap-8 items-start
              ${notif.accent ? 'bg-surface shadow-xl shadow-black/5' : 'bg-surface-bright'}
            `}
          >
            {notif.accent && (
              <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
            )}
            
            <div className={`
              p-4 rounded-sm shrink-0 border border-surface-variant
              ${notif.accent ? 'bg-surface-container-low text-primary' : 'bg-surface-container-low text-secondary'}
            `}>
              <Icons.Bell size={32} />
            </div>

            <div className="flex-grow flex flex-col gap-2">
              <div className="flex justify-between items-start gap-4 w-full">
                <h2 className="headline-md text-xl">{notif.title}</h2>
                <span className="label-sm text-secondary lowercase tracking-normal">{notif.time}</span>
              </div>
              <p className="body-md text-on-surface-variant mt-2 max-w-xl">
                {notif.message}
              </p>
              
              {notif.actionLabel && (
                <div className="mt-6 flex flex-wrap gap-4 items-center">
                  <Link 
                    to={notif.type === 'quote' ? '/quote-review' : '#'}
                    className="bg-primary text-white px-8 py-3 label-md rounded-sm hover:opacity-90 transition-all font-bold"
                  >
                    {notif.actionLabel}
                  </Link>
                  <button className="text-secondary label-md border border-surface-variant px-8 py-3 rounded-sm hover:bg-surface-container transition-all lowercase tracking-normal font-normal">
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
