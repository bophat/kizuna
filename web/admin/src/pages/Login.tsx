import React from 'react';
import { motion } from 'motion/react';
import { Lock, Mail, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { apiFetch } from '../lib/api';

export default function Login() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch('/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        
        // Verify if user is staff/admin
        const meResponse = await apiFetch('/me/');
        if (meResponse.ok) {
          const userData = await meResponse.json();
          if (userData.is_staff || userData.is_superuser) {
            window.location.href = '/';
          } else {
            setError('Access denied. Admin privileges required.');
            localStorage.clear();
          }
        } else {
          setError('Failed to verify account permissions.');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      setError('A connection error occurred. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans">
      {/* Visual Side */}
      <div className="hidden md:flex md:w-1/2 bg-brand-ink relative overflow-hidden items-center justify-center p-20">
        <div className="absolute inset-0 opacity-20">
          <img 
            src="https://images.unsplash.com/photo-1531973819741-e27a5ae2cc7b?q=80&w=1200&auto=format&fit=crop" 
            alt="Craft background" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="relative z-10 max-w-lg text-center">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
          >

            <Logo className="mb-16 justify-center" isDark size="xl" />
            <p className="text-brand-clay/60 text-lg font-light leading-relaxed font-serif italic">
              Curating the finest traditions of Japanese craftsmanship for a modern world.
            </p>
          </motion.div>
        </div>
        
        <div className="absolute bottom-12 left-12 right-12 flex justify-between items-center text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold">
          <span>Est. 1924</span>
          <span>Tokyo • Kyoto • Osaka</span>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 bg-brand-paper flex items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-12">
            <h2 className="text-3xl font-serif font-bold text-brand-ink mb-2">Welcome Back</h2>
            <p className="text-brand-ink/50 text-sm italic font-serif">Please sign in to access the administration portal.</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-brand-red/20 rounded-md flex items-center gap-3 text-brand-red text-xs font-bold uppercase tracking-wider"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40 ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/20 group-focus-within:text-brand-red transition-colors" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@kogei-gallery.jp"
                  className="w-full bg-white border border-brand-clay rounded-md px-12 py-4 text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/10 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40">Password</label>
                <a href="#" className="text-[10px] uppercase tracking-widest font-bold text-brand-red hover:underline transition-all">Forgot?</a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/20 group-focus-within:text-brand-red transition-colors" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-brand-clay rounded-md px-12 py-4 text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/10 transition-all shadow-sm"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-ink/20 hover:text-brand-ink transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-ink text-white py-5 rounded-md font-bold text-sm uppercase tracking-[0.2em] hover:bg-brand-red transition-all shadow-xl hover:shadow-brand-red/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Authenticate</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-12 pt-12 border-t border-brand-clay text-center">
            <p className="text-[10px] text-brand-ink/30 uppercase tracking-widest font-bold leading-loose">
              If you have issues accessing your account,<br /> 
              contact the <span className="text-brand-ink font-bold">Systems Department</span>.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

