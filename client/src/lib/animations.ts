// Animation utilities and configurations for the app

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

export const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
  transition: { duration: 0.3, ease: "easeOut" },
};

export const slideIn = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2, ease: "easeOut" },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2, ease: "easeOut" },
};

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2 },
};

// CSS animation classes
export const cssAnimations = {
  fadeIn: "animate-in fade-in duration-300",
  fadeOut: "animate-out fade-out duration-200",
  slideUp: "animate-in slide-in-from-bottom-4 duration-300",
  slideDown: "animate-in slide-in-from-top-4 duration-300",
  slideLeft: "animate-in slide-in-from-right-4 duration-300",
  slideRight: "animate-in slide-in-from-left-4 duration-300",
  scaleIn: "animate-in zoom-in-95 duration-200",
  spin: "animate-spin",
  pulse: "animate-pulse",
  bounce: "animate-bounce",
};

// Stagger delay generator
export function staggerDelay(index: number, baseDelay = 50): string {
  return `${index * baseDelay}ms`;
}

// Card hover effect classes
export const cardHover = "transition-all duration-200 hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5";

// Button loading animation
export const buttonLoading = "pointer-events-none opacity-70";

// List item animation delay
export function getListItemStyle(index: number): React.CSSProperties {
  return {
    animationDelay: staggerDelay(index),
    animationFillMode: "backwards",
  };
}
