import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h1 className="text-8xl md:text-9xl font-serif font-light text-primary/10 tracking-tighter mb-4">
          404
        </h1>
        <h2 className="text-2xl md:text-3xl font-serif font-medium text-primary mb-6">
          {t('common.page_not_found', 'Page Not Found')}
        </h2>
        <p className="text-primary/60 mb-10 max-w-md mx-auto leading-relaxed">
          {t('common.page_not_found_desc', "The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.")}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-secondary hover:bg-primary/90 transition-all duration-300 group"
        >
          <span className="text-sm tracking-[0.2em] uppercase">
            {t('common.back_to_home', 'Return to Home')}
          </span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </motion.div>
    </div>
  );
}
