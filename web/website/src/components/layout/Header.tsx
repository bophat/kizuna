import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Icons } from '../Icons';
import { Logo } from '../Logo';
import { cn } from '@/lib/utils';
import { ChevronDown, Globe, Package, Headset } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

export function Header() {
  const { t, i18n } = useTranslation();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isCheckout = location.pathname.startsWith('/checkout');
  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  const { cart } = useCart();
  const { wishlistItems } = useWishlist();

  const languages = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'ja', label: '日本語', short: 'JA' },
    { code: 'vi', label: 'Tiếng Việt', short: 'VI' }
  ];

  const currentLang = languages.find(l => i18n.language.startsWith(l.code)) || languages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('q') as string;
    if (query?.trim()) {
      navigate(`/collections?search=${encodeURIComponent(query.trim())}`);
    }
    setIsSearchOpen(false);
    e.currentTarget.reset();
  };

  // Define which elements to show based on page type
  const showSearch = !isCheckout && !isAuthPage;
  const showIcons = !isCheckout && !isAuthPage;
  const showStatus = isCheckout;
  const showClose = isAuthPage;

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 z-50 transition-all">
      <div className="max-w-[1280px] mx-auto flex items-center px-8 h-20 w-full">
        {/* Logo - Left */}
        <div className="flex-shrink-0 flex items-center h-full">
          <Link to="/" className="flex items-center group">
            <Logo className="transition-transform group-hover:scale-105" />
          </Link>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Group - Right */}
        <div className="flex flex-row-reverse items-center gap-4 md:gap-6 ml-auto">
          {showIcons && (
            <div className="hidden md:flex items-center gap-5 flex-shrink-0">
              <Link to="/collections" className="text-secondary hover:text-primary transition-colors" title={t('nav.products')}>
                <Package size={22} />
              </Link>

              <Link to="/concierge" className="text-secondary hover:text-primary transition-colors" title={t('nav.concierge')}>
                <Headset size={22} />
              </Link>

              <Link to="/wishlist" className="text-secondary hover:text-primary transition-colors relative" title={t('nav.wishlist')}>
                <Icons.Heart size={22} />
                {wishlistItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                    {wishlistItems.length}
                  </span>
                )}
              </Link>

              <Link to="/cart" className="text-secondary hover:text-primary transition-colors relative" title={t('nav.cart')}>
                <Icons.ShoppingBag size={22} />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                  {cart?.items?.length || 0}
                </span>
              </Link>

              <Link to={localStorage.getItem('access_token') ? "/profile" : "/login"} className="text-secondary hover:text-primary transition-colors" title={t('auth.sign_in')}>
                <Icons.User size={22} />
              </Link>
            </div>
          )}

          {showStatus && (
            <div className="flex items-center gap-2 text-secondary px-4 py-2 bg-zinc-50 dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800">
              <Icons.Lock size={16} className="text-primary" />
              <span className="label-xs font-bold tracking-widest uppercase">{t('checkout.secure_checkout')}</span>
            </div>
          )}

          {showClose && (
            <Link to="/" className="text-secondary hover:text-primary transition-all p-2 bg-zinc-50 dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800">
              <Icons.X size={20} />
            </Link>
          )}

          {/* Language Switcher - Visually Middle */}
          {(!isCheckout && !isAuthPage) && (
            <div className="relative pl-2 md:pl-4 border-l border-zinc-200 dark:border-zinc-800 flex-shrink-0" ref={langRef}>
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center gap-2 text-secondary hover:text-primary transition-colors py-2"
              >
                <Globe size={18} />
                <span className="label-xs uppercase font-medium">{currentLang.short}</span>
                <ChevronDown size={14} className={cn("transition-transform duration-300", isLangOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isLangOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-40 bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 rounded-sm py-2 overflow-hidden"
                  >
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          i18n.changeLanguage(lang.code);
                          setIsLangOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2.5 label-sm transition-colors",
                          i18n.language.startsWith(lang.code)
                            ? "bg-zinc-50 dark:bg-zinc-800 text-primary font-bold"
                            : "text-secondary hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-primary"
                        )}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Search Bar - Desktop - Visually Left */}
          {showSearch && (
            <div className="hidden md:block w-72 focus-within:w-[500px] transition-all duration-500 ease-in-out mr-2" ref={searchRef}>
              <form onSubmit={handleSearch} className="w-full">
                <div className="relative w-full group">
                  <input
                    type="text"
                    name="q"
                    autoComplete="off"
                    placeholder={t('common.search') + "..."}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-white/50 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-full py-2 pl-10 pr-4 body-sm outline-none transition-all duration-300 shadow-lg hover:border-primary/50"
                  />
                  <button
                    type="submit"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50 group-hover:text-primary transition-colors"
                  >
                    <Icons.Search size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Mobile Search Toggle */}
          {showSearch && (
            <div className="md:hidden relative" ref={searchRef}>
              <AnimatePresence mode="wait">
                {!isSearchOpen ? (
                  <motion.button
                    key="search-icon"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSearchOpen(true)}
                    className="p-2 text-secondary hover:text-primary transition-colors"
                  >
                    <Icons.Search size={22} />
                  </motion.button>
                ) : (
                  <motion.div
                    key="search-input"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 280, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10"
                  >
                    <form onSubmit={handleSearch} className="relative group">
                      <input
                        autoFocus
                        type="text"
                        name="q"
                        autoComplete="off"
                        placeholder={t('common.search') + "..."}
                        className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-white/50 rounded-full py-2 pl-10 pr-4 body-sm outline-none shadow-2xl focus:border-primary/50"
                      />
                      <button
                        type="submit"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-primary transition-colors"
                      >
                        <Icons.Search size={16} />
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
