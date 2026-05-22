import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface QuickActionProps {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  link: string;
  delay?: number;
}

export function QuickAction({ title, icon: Icon, link, delay = 0 }: QuickActionProps) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}>
      <Link
        to={link}
        className="flex items-center justify-between p-6 bg-white border border-brand-clay rounded-sm hover:border-brand-red/30 hover:shadow-lg transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 bg-brand-paper rounded-sm text-brand-ink group-hover:text-brand-red transition-colors">
            <Icon size={18} />
          </div>
          <span className="text-xs font-bold text-brand-ink uppercase tracking-wider">{title}</span>
        </div>
        <ArrowRight size={16} className="text-brand-clay group-hover:text-brand-red group-hover:translate-x-1 transition-all" />
      </Link>
    </motion.div>
  );
}
