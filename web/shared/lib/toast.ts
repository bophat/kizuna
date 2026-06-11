import { toast as sonnerToast } from 'sonner';

export const toast = {
  success: (message: string, description?: string) => 
    sonnerToast.success(message, { description }),
    
  error: (message: string, description?: string) => 
    sonnerToast.error(message, { description }),
    
  info: (message: string, description?: string) => 
    sonnerToast.info(message, { description }),
    
  warning: (message: string, description?: string) => 
    sonnerToast.warning(message, { description }),
    
  // You can define standard messages here to be used project-wide
  messages: {
    saveSuccess: 'Saved successfully',
    saveError: 'Failed to save changes. Please try again.',
    createSuccess: 'Created successfully',
    updateSuccess: 'Updated successfully',
    deleteSuccess: 'Deleted successfully',
    networkError: 'Network error. Please check your connection.',
    unauthorized: 'Session expired. Please log in again.',
    forbidden: 'You do not have permission to perform this action.',
  }
};
