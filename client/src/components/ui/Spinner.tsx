interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

/** Small ring spinner that inherits the current text color. */
const Spinner = ({ size = 16, className = '', label }: SpinnerProps) => (
  <span role={label ? 'status' : undefined} className={`inline-flex items-center ${className}`}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
    {label && <span className="sr-only">{label}</span>}
  </span>
);

export default Spinner;
