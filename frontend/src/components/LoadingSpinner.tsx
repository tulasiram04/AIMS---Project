import { motion } from 'framer-motion';

interface Props {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ message = 'Loading...', size = 'md' }: Props) {
  const sizes = { sm: 'h-6 w-6', md: 'h-10 w-10', lg: 'h-16 w-16' };
  const borderSizes = { sm: 'border-2', md: 'border-3', lg: 'border-4' };

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <motion.div
        className={`${sizes[size]} ${borderSizes[size]} border-primary-200 border-t-primary rounded-full`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      {message && (
        <motion.p
          className="text-sm text-gray-500 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}
