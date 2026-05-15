import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'ja', label: '日本語', short: 'JA' },
    { code: 'vi', label: 'Tiếng Việt', short: 'VI' }
  ];

  const currentLang = languages.find(l => i18n.language.startsWith(l.code)) || languages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-[10px] font-bold text-brand-ink/50 bg-brand-clay/50 hover:bg-brand-clay px-3 py-1.5 rounded-md uppercase tracking-tighter transition-colors"
      >
        <Globe size={14} className="text-brand-ink/40" />
        <span>{currentLang.short}</span>
        <ChevronDown size={10} className={cn("transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-32 bg-white shadow-2xl border border-brand-clay rounded-sm py-1 overflow-hidden z-50"
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  i18n.changeLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-tighter transition-colors",
                  i18n.language.startsWith(lang.code)
                    ? "bg-brand-paper text-brand-red"
                    : "text-brand-ink/60 hover:bg-brand-paper hover:text-brand-ink"
                )}
              >
                {lang.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
