import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Theme } from '../types/quiz';

/**
 * UIStore - Zustand Store для управления UI состоянием
 *
 * Используется в Task3 и Task4
 */

interface UIStore {
  // Состояние
  theme: Theme;
  soundEnabled: boolean;
  // Actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleSound: () => void;
}

// Создаем store с помощью create<UIStore>()
// Обернули в persist middleware для автосохранения в localStorage
export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Начальное состояние
      theme: 'light',
      soundEnabled: true,

      // Actions
      setTheme: (theme: Theme) => set({ theme }),

      toggleTheme: () => set((state) => ({ 
        theme: state.theme === 'light' ? 'dark' : 'light' 
      })),

      toggleSound: () => set((state) => ({ 
        soundEnabled: !state.soundEnabled 
      })),
    }),
    {
      name: 'ui-storage', // ключ в localStorage
    }
  )
);