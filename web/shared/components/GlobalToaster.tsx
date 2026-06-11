import { Toaster } from 'sonner';

export function GlobalToaster() {
  return (
    <Toaster 
      position="top-right" 
      richColors 
      closeButton
      theme="light"
      toastOptions={{
        className: 'font-serif',
      }}
    />
  );
}
