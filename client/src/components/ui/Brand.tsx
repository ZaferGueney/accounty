interface BrandProps {
  showName?: boolean;
  className?: string;
}

/** Accounty wordmark: an ink tile with a Greek alpha, then the name. */
const Brand = ({ showName = true, className = '' }: BrandProps) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <span
      aria-hidden="true"
      className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-[1.05rem] font-semibold leading-none text-canvas"
    >
      <span className="-mt-0.5">α</span>
    </span>
    {showName && (
      <span className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">Accounty</span>
    )}
  </span>
);

export default Brand;
