import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Users, 
  UserSquare, 
  Settings,
  Menu,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './Logo';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Package, label: 'Inventory', path: '/inventory' },
  { icon: Menu, label: 'Categories', path: '/categories' },
  { icon: ShoppingBag, label: 'Orders', path: '/orders' },
  { icon: Users, label: 'Users', path: '/users' },
  { icon: UserSquare, label: 'Staff & Roles', path: '/staff' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = React.useState(true);

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
              "fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-brand-clay flex flex-col transition-all duration-300",
              !isOpen && "md:w-20"
            )}
          >
            <Link to="/" className="p-8 flex items-center group">
              <Logo 
                className="transition-transform group-hover:scale-105" 
                isCollapsed={!isOpen}
              />
            </Link>

            <nav className="flex-1 px-4 py-6 space-y-1">
              {navItems.map((item) => (
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
                      <span className={cn("transition-all duration-300", !isOpen && "hidden md:hidden")}>
                        {item.label}
                      </span>
                      {isActive && (
                        <motion.div 
                          layoutId="sidebar-active"
                          className="ml-auto w-1.5 h-1.5 bg-brand-red rounded-full"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="p-6 border-t border-brand-clay">
              <div className="flex items-center gap-3 p-2">
                <div className="w-10 h-10 rounded-full bg-brand-clay flex items-center justify-center overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop" 
                    alt="Admin" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                {isOpen && (
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-brand-ink truncate">Akira Tanaka</p>
                    <p className="text-[10px] text-brand-ink/50 uppercase tracking-tighter">Chief Curator</p>
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
