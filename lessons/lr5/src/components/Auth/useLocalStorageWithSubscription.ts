import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

export const useLocalStorageWithSubscription = <T,>(key: string) => {
  const queryClient = useQueryClient();

  // 1. Теперь setValue принимает объект нужного типа T, а не просто строку
  const setValue = useCallback((value: T | null) => {
    // Кладем в кэш React Query нормальный объект (чтобы UI обновился мгновенно)
    queryClient.setQueryData(['localStorage', key], value);
    
    if (value !== null) {
      // А вот в localStorage физически пишем строку
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, stringValue);
    } else {
      localStorage.removeItem(key);
    }
  }, [key, queryClient]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key) {
        // Если данные поменялись в другой вкладке браузера - парсим их для кэша
        try {
          const parsed = event.newValue !== null ? JSON.parse(event.newValue) as T : null;
          queryClient.setQueryData(['localStorage', key], parsed);
        } catch {
          queryClient.setQueryData(['localStorage', key], event.newValue as T);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    }
  }, [key, queryClient]);

  return {
    ...useQuery({
      queryKey: ['localStorage', key],
      queryFn: () => {
        const item = localStorage.getItem(key);
        if (item === null) {
          return null;
        }
        try {
          return JSON.parse(item) as T;
        } catch {
          return item as T;
        }
      },
      staleTime: Infinity,
      retry: false,
    }),
    setValue
  };
};