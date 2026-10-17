import Spinner from '@/components/ui/Spinner';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

const px = { sm: 16, md: 22, lg: 30 };

const LoadingSpinner = ({ size = 'md', message, className = '' }: LoadingSpinnerProps) => (
  <div className={`flex flex-col items-center justify-center text-muted ${className}`}>
    <Spinner size={px[size]} label={message ? undefined : 'Loading'} />
    {message && <p className="mt-3 text-sm">{message}</p>}
  </div>
);

export default LoadingSpinner;
