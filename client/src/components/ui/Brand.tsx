interface BrandProps {
  showName?: boolean;
  className?: string;
}

/** BillMou wordmark: an ink tile with a Greek beta, then the name. */
const Brand = ({ showName = true, className = '' }: BrandProps) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <span
      aria-hidden="true"
      className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-[1.05rem] font-semibold leading-none text-canvas"
    >
      <span className="-mt-0.5">β</span>
    </span>
    {showName && (
      <span className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">Bill<span className="font-normal">Mou</span></span>
    )}
  </span>
);

export default Brand;
