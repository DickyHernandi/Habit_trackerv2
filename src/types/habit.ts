export interface Habit {

  id?: string;

  name: string;

  type: 'timed' | 'progress';

  duration?: number;

  target?: number;

  unit?: string;

  completed: boolean;

  createdAt: any;

}