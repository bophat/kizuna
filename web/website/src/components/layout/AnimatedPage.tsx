import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { fadeUp, tweenBase } from '@/lib/motion';

type AnimatedPageProps = {
  children: ReactNode;
};

export function AnimatedPage({ children }: AnimatedPageProps) {
  return (
    <motion.div
      {...fadeUp}
      transition={tweenBase}
      className="min-h-full w-full"
    >
      {children}
    </motion.div>
  );
}
