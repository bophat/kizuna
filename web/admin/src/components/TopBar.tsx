import React from 'react';
import { Bell, Search, Globe } from 'lucide-react';
import { motion } from 'motion/react';

export function TopBar() {
  return (
    <header className="h-20 bg-white border-b border-brand-clay flex items-center justify-between px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/30" />
          <input 
            type="text" 
            placeholder="Search artifacts, orders, or staff..."
            className="w-full pl-11 pr-4 py-2.5 bg-brand-paper border border-brand-clay rounded-lg text-sm focus:outline-none focus:border-brand-red/30 transition-all placeholder:text-brand-ink/30"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <a 
          href="http://localhost:5173" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hidden lg:flex items-center gap-2 text-xs font-semibold text-brand-ink/60 hover:text-brand-red transition-colors uppercase tracking-wider"
        >
          <Globe size={14} />
          <span>View Public Site</span>
        </a>

        <div className="h-8 w-px bg-brand-clay hidden lg:block" />

        <div className="hidden md:flex items-center gap-2 text-[10px] font-bold text-brand-ink/50 bg-brand-clay px-3 py-1.5 rounded-md uppercase tracking-tighter">
          <span>EN / JP</span>
        </div>

        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2.5 text-brand-ink/60 hover:text-brand-red hover:bg-brand-paper rounded-full transition-all"
        >
          <Bell size={20} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-brand-red rounded-full border-2 border-white animate-pulse"></span>
        </motion.button>
      </div>
    </header>
  );
}
