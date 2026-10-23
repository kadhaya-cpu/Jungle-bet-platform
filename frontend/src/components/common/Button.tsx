import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Reusable Gold-Accented Button with Framer Motion micro-interactions
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#FFD700]/50 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:
      'bg-[#FFD700] text-[#0f0f0f] hover:bg-gradient-to-r hover:from-[#FFD700] hover: via-[#FFE55C] hover:to-[#F59E0B] shadow-[0_0_20px_rgba(255,215,0,0.25)] hover:shadow-[0_0_28px_rgba(255,215,0,0.45)]',
    secondary:
      'bg-[#262626] text-white border border-white/10 hover:border-[#FFD700]/50 hover:bg-[#303030]',
    outline:
      'bg-transparent text-[#FFD700] border border-[#FFD700]/60 hover:bg-[#FFD700]/10 hover:border-[#FFD700]',
    danger:
      'bg-red-600/90 text-white border border-red-500/40 hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)]',
    ghost:
      'bg-transparent text-gray-300 hover:text-[#FFD700] hover:bg-white/5',
  };

  const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3.5 text-base gap-2.5',
  };

  return (
    <motion.button
      whileHover={disabled || isLoading ? undefined : { scale: 1.015 }}
      whileTap={disabled || isLoading ? undefined : { scale: 0.985 }}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </motion.button>
  );
};

export default Button;
