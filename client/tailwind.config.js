/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic design tokens (see src/styles/globals.css for values)
        canvas: token('canvas'),
        surface: token('surface'),
        sunken: token('sunken'),
        line: token('line'),
        'line-strong': token('line-strong'),
        ink: token('ink'),
        'ink-2': token('ink-2'),
        muted: token('muted'),
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          soft: token('accent-soft'),
          fg: token('accent-fg'),
        },
        success: { DEFAULT: token('success'), soft: token('success-soft') },
        warning: { DEFAULT: token('warning'), soft: token('warning-soft') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft'), hover: token('danger-hover') },
        // legacy aliases
        background: 'rgb(var(--canvas))',
        foreground: 'rgb(var(--ink))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.625rem',
        xl: '0.875rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(var(--shadow) / 0.06)',
        card: '0 1px 2px 0 rgb(var(--shadow) / 0.05), 0 1px 3px 0 rgb(var(--shadow) / 0.04)',
        pop: '0 4px 8px -2px rgb(var(--shadow) / 0.10), 0 12px 32px -8px rgb(var(--shadow) / 0.18)',
        modal: '0 8px 16px -4px rgb(var(--shadow) / 0.14), 0 24px 64px -12px rgb(var(--shadow) / 0.30)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        // Motion starts from a visible state: only position/scale animate.
        'pop-in': {
          from: { transform: 'translateY(6px) scale(0.985)' },
          to: { transform: 'translateY(0) scale(1)' },
        },
        'sheet-in': {
          from: { transform: 'translateY(16px)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        'pop-in': 'pop-in 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'sheet-in': 'sheet-in 240ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
