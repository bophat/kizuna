import { Link } from 'react-router-dom';
import { Logo } from '../Logo';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-stone-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 mt-auto">
      <div className="max-w-[1280px] mx-auto py-16 px-8 flex flex-col md:flex-row justify-between items-center gap-12">
        <Link to="/" className="flex items-center group">
          <Logo className="transition-transform group-hover:scale-105" />
        </Link>
        <div className="flex flex-wrap justify-center gap-8">
          {['Privacy Policy', 'Terms of Service', 'Shipping & Returns', 'Contact'].map((item) => (
            <Link
              key={item}
              to="#"
              className="label-sm text-zinc-500 hover:text-primary transition-colors lowercase tracking-wider border-b border-transparent hover:border-primary pb-1"
            >
              {item}
            </Link>
          ))}
        </div>
        <div className="label-sm text-zinc-400 normal-case tracking-normal">
          © {currentYear} KIZUNA. ALL RIGHTS RESERVED.
        </div>
      </div>
    </footer>
  );
}
