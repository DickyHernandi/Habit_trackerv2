import { create } from 'zustand';

interface HabitStore {
  points: number;
  addPoints: (value: number) => void;
}

export const useHabitStore = create<HabitStore>((set) => ({
  points: 0,

  addPoints: (value) =>
    set((state) => ({
      points: state.points + value
    }))
}));