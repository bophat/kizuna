import { Notification } from './types';

export const NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'quote',
    title: 'New Quote Available',
    message: 'The artisan has reviewed your request and submitted a detailed proposal and timeline.',
    time: 'Just now',
    actionLabel: 'View Quote',
    accent: true
  },
  {
    id: '2',
    type: 'order',
    title: 'Order Dispatched',
    message: 'Your order has left the studio and is currently in transit via Japan Post.',
    time: 'Yesterday'
  }
];
