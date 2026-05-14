import { Link, useLocation } from 'react-router-dom';
import { Icons } from '../Icons';

export function ConciergeFAB() {
  const location = useLocation();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="fixed bottom-20 md:bottom-8 right-6 md:right-8 z-[60]">
      <Link
        to="/concierge"
        className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center gap-3 px-6 py-3 md:px-8 md:py-4 rounded-full shadow-2xl hover:shadow-primary/20 hover:-translate-y-1 transition-all group border border-zinc-800 dark:border-zinc-200"
      >
        <Icons.Sparkles size={20} className="text-primary animate-pulse" />
        <span className="label-sm md:label-md tracking-normal normal-case font-bold">Ask Kenji</span>
      </Link>
    </div>
  );
}
