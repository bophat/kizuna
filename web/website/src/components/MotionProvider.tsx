import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import type { ReactNode } from 'react';
import { tweenBase } from '@/lib/motion';

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig
        reducedMotion="user"
        transition={tweenBase}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
