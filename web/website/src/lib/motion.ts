/** Easing mượt (ease-out expo) — dùng thống nhất toàn site */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const tweenFast = { duration: 0.2, ease: EASE_OUT };
export const tweenBase = { duration: 0.32, ease: EASE_OUT };
export const tweenSlow = { duration: 0.45, ease: EASE_OUT };

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
};

export const slideX = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

/** Spring nhẹ cho layoutId (nav pill) — tránh bounce mạnh */
export const springNav = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 42,
  mass: 0.65,
};
