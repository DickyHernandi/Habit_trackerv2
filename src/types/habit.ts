export interface Habit {

  id?: string;

  name: string;

  type: 'timed' | 'progress';

  duration?: number;

  target?: number;

  completed: boolean;

  createdAt: any;

}