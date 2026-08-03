import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  UserSquare,
  User,
  Menu,
  MessageCircle,
  X,
  Settings as SettingsIcon,
  Calculator,
  Sparkles,
  ShieldCheck,
  FileText,
  TicketPercent,
  UsersRound,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from '@izuna/shared/components/Logo';
import { useTranslation } from 'react-i18next';

export function Sidebar() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(true);

  const navItems = [
    { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/' },
    { icon: MessageCircle, label: t('nav.chat'), path: '/chat' },
    { icon: ShieldCheck, label: t('nav.approvals'), path: '/approvals' },
    { icon: Sparkles, label: t('nav.ai_discovery'), path: '/ai-discovery' },
    { icon: Package, label: t('nav.inventory'), path: '/inventory' },
    { icon: Menu, label: t('nav.categories'), path: '/categories' },
    { icon: ShoppingBag, label: t('nav.orders'), path: '/orders' },
    { icon: TicketPercent, label: t('nav.coupons'), path: '/coupons' },
    { icon: UsersRound, label: t('nav.affiliates'), path: '/affiliates' },
    { icon: Users, label: t('nav.users'), path: '/users' },
    { icon: UserSquare, label: t('nav.staff'), path: '/staff' },
    { icon: Calculator, label: t('nav.pricing'), path: '/pricing' },
    { icon: FileText, label: t('nav.content_pages'), path: '/content-pages' },
  ];

  const accountNavItems = [
    { icon: User, label: t('nav.profile'), path: '/profile' },
    { icon: SettingsIcon, label: t('nav.settings'), path: '/settings' },
  ];

  const renderNavItem = (item: (typeof navItems)[number]) => (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) => cn(
        "flex items-center gap-4 px-4 py-3.5 rounded-lg transition-all duration-300 group text-sm font-semibold tracking-tight",
        isActive
          ? "bg-brand-paper text-brand-red shadow-[0_2px_10px_rgba(153,5,29,0.1)] border border-brand-red/10"
          : "text-brand-ink/60 hover:bg-brand-paper hover:text-brand-ink"
      )}
    >
      {({ isActive }) => (
        <>
          <item.icon size={20} className={cn("shrink-0 transition-all duration-300 group-hover:scale-110", isActive && "text-brand-red")} />
          <span className={cn("transition-all duration-300", !isOpen && "hidden md:hidden")}>{item.label}</span>
          {isActive && <motion.div layoutId="sidebar-active" className="ml-auto w-1.5 h-1.5 bg-brand-red rounded-full" />}
        </>
      )}
    </NavLink>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-brand-ink text-brand-paper rounded-full md:hidden shadow-xl"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "fixed md:static inset-y-0 left-0 z-40 h-screen min-h-0 w-64 overflow-hidden bg-white border-r border-brand-clay flex flex-col transition-all duration-300",
              !isOpen && "md:w-20"
            )}
          >
            <Link to="/" className="shrink-0 p-8 flex items-center group">
              <Logo 
                className="transition-transform group-hover:scale-105" 
                isCollapsed={!isOpen}
                forceBlack
              />
            </Link>

            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-1">
              {navItems.map(renderNavItem)}
            </nav>

            <nav className="shrink-0 space-y-1 border-t border-brand-clay bg-white px-4 py-4">
              {accountNavItems.map(renderNavItem)}
            </nav>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
