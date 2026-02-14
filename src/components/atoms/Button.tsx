import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { type HTMLMotionProps, motion } from 'motion/react';
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

// ============================================
// BUTTON VARIANTS (ClaudeHydra — Matrix Green Accent)
// ============================================

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-medium',
    'transition-all duration-200',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-matrix-accent/50',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-matrix-bg-primary',
    'rounded-lg',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-matrix-accent text-matrix-bg-primary',
          'border border-matrix-accent',
          'hover:bg-matrix-accent-glow',
          'hover:shadow-[0_0_15px_var(--matrix-accent)]',
        ].join(' '),
        secondary: [
          'bg-[var(--glass-bg)] text-[var(--matrix-text-primary)]',
          'border border-matrix-border',
          'hover:bg-matrix-bg-tertiary hover:border-matrix-accent-dim',
        ].join(' '),
        ghost: [
          'bg-transparent',
          'text-[var(--matrix-text-secondary)]',
          'hover:text-matrix-accent',
          'hover:bg-[rgba(255,255,255,0.08)]',
        ].join(' '),
        danger: [
          'bg-matrix-error text-white',
          'border border-matrix-error',
          'hover:shadow-[0_0_15px_var(--matrix-error)]',
        ].join(' '),
      },
      size: {
        sm: 'text-xs px-3 py-1.5',
        md: 'text-sm px-4 py-2',
        lg: 'text-base px-6 py-3',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

// ============================================
// TYPES
// ============================================

type MotionButtonProps = HTMLMotionProps<'button'>;

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof MotionButtonProps>,
    MotionButtonProps,
    VariantProps<typeof buttonVariants> {
  /** Show loading spinner and disable interactions */
  isLoading?: boolean;
  /** Text to show while loading (defaults to children) */
  loadingText?: string;
  /** Icon rendered before children */
  leftIcon?: ReactNode;
  /** Icon rendered after children */
  rightIcon?: ReactNode;
}

// ============================================
// COMPONENT
// ============================================

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, isLoading = false, loadingText, leftIcon, rightIcon, children, disabled, ...props },
    ref,
  ) => {
    return (
      <motion.button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        whileHover={disabled || isLoading ? undefined : { scale: 1.02 }}
        whileTap={disabled || isLoading ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText ?? children}
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  },
);

Button.displayName = 'Button';
