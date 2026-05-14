import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  actionLink?: string;
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  actionText = "Continue Shopping", 
  actionLink = "/collections" 
}: EmptyStateProps) {
  return (
    <div className="text-center py-12 bg-surface rounded-lg">
      <div className="mx-auto text-surface-variant mb-6 w-fit">
        {icon}
      </div>
      <h2 className="headline-md font-serif text-on-surface mb-2">{title}</h2>
      <p className="body-lg text-secondary mb-8 max-w-[600px] mx-auto px-4">
        {description}
      </p>
      <Link 
        to={actionLink}
        className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-sm font-bold uppercase tracking-wider hover:bg-primary-container transition-colors"
      >
        {actionText}
        <ArrowRight size={18} />
      </Link>
    </div>
  );
}
