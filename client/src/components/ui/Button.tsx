import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Spinner from './Spinner';
import Icon from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost' | 'success';
type Size = 'sm' | 'md' | 'lg';

// Literal class names so Tailwind's content scan keeps every variant in the CSS.
const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  'danger-ghost': 'btn-danger-ghost',
  success: 'btn-success',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  icon?: string;
  iconRight?: string;
  iconOnly?: boolean;
  children?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    iconOnly = false,
    disabled,
    className = '',
    type = 'button',
    children,
    ...rest
  },
  ref
) {
  const classes = [
    'btn',
    variantClass[variant],
    size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '',
    iconOnly ? 'btn-icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon ? <Icon name={icon} /> : null}
      {children}
      {iconRight && !loading && <Icon name={iconRight} />}
    </button>
  );
});

export default Button;
