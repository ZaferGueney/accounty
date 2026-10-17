import { useId, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

interface FieldProps {
  label: ReactNode;
  children: ReactElement<any>;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optionalLabel?: ReactNode;
  className?: string;
  id?: string;
}

/**
 * Label + control + hint/error, wired up for screen readers.
 * The child control receives id, aria-invalid and aria-describedby.
 */
const Field = ({ label, children, hint, error, required, optionalLabel, className = '', id }: FieldProps) => {
  const autoId = useId();
  const controlId = id || (isValidElement(children) && (children.props as any).id) || `f${autoId}`;
  const describedBy = error ? `${controlId}-err` : hint ? `${controlId}-hint` : undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<any>, {
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        required: required || (children.props as any).required,
      })
    : children;

  return (
    <div className={className}>
      <label htmlFor={controlId} className="label">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        {optionalLabel && <span className="ml-1.5 font-normal text-muted">{optionalLabel}</span>}
      </label>
      {control}
      {error ? (
        <p id={`${controlId}-err`} className="field-error">{error}</p>
      ) : hint ? (
        <p id={`${controlId}-hint`} className="hint">{hint}</p>
      ) : null}
    </div>
  );
};

export default Field;
