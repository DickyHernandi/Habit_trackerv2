import { create } from 'zustand';

// Store sederhana untuk menyimpan data poin habit secara global.
// Biasanya dipakai agar komponen lain bisa membaca atau mengubah poin tanpa prop drilling.
interface HabitStore {
  points: number;
  addPoints: (value: number) => void;
}

export const useHabitStore = create<HabitStore>((set) => ({
  points: 0,

  // Fungsi ini menambah poin habit dan memperbarui state global agar komponen lain bisa langsung melihat nilainya.
  addPoints: (value) =>
    set((state) => ({
      points: state.points + value
    }))
}));