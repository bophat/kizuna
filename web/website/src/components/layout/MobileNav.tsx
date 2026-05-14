import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icons } from '../Icons';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const { t } = useTranslation();
  const location = useLocation();

  const navItems = [
    {
      to: '/collections',
      icon: Icons.Package,
      label: t('nav.products'),
    },
    {
      to: '/wishlist',
      icon: Icons.Heart,
      label: t('nav.wishlist'),
    },
    {
      to: '/cart',
      icon: Icons.ShoppingBag,
      label: t('nav.cart'),
      badge: 0,
    },
    {
      to: '/login',
      icon: Icons.User,
      label: t('nav.account'),
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 z-50 transition-all pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-16 px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-col items-center gap-1 min-w-[64px] transition-all duration-300",
                isActive ? "text-primary" : "text-zinc-500"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-nav"
                  className="absolute -top-1 w-12 h-1 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <div className="relative pt-1">
                <item.icon size={22} className={cn("transition-transform duration-300", isActive && "scale-110 stroke-[2.5px]")} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider scale-90">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
