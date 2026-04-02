import { useCallback, useEffect, useRef } from 'react';
import { useLocalStorageWithSubscription } from './useLocalStorageWithSubscription';
import { postApiAuthGithubCallback, getApiAuthMe } from '../../../generated/api/auth/auth';
import { useQuery } from '@tanstack/react-query';

const GITHUB_CLIENT_ID = 'Ov23lieQV5VzylgzlWhm'; 

export const useAuth = () => {
  const { isLoading: isTokenLoading, data: token, setValue: setToken } = useLocalStorageWithSubscription<string>('auth_token');
  const { data: user, setValue: setUser } = useLocalStorageWithSubscription<any>('auth_user');

  const isCodeProcessed = useRef(false);

  // 1. Используем имя apiResponse для соответствия типам
  const { data: apiResponse } = useQuery({
    queryKey: ['auth_me'],
    queryFn: () => getApiAuthMe(),
    enabled: !!token, 
    retry: false,
  });

  // 2. Умная синхронизация с обходом ошибки типов через (apiResponse as any)
  useEffect(() => {
    // Нам нужно достать именно поле .user из ответа бэкенда
    const userData = (apiResponse as any)?.user || apiResponse;
    
    if (userData && JSON.stringify(userData) !== JSON.stringify(user)) {
      console.log("🔄 Обновляю данные пользователя из API:", userData);
      setUser(userData);
    }
  }, [apiResponse, user, setUser]);

  const login = useCallback(() => {
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}`;
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !isCodeProcessed.current) {
      isCodeProcessed.current = true; 

      postApiAuthGithubCallback({ code })
        .then((res) => {
          if (res.token) setToken(res.token);
          
          const initialUser = (res as any).user || res;
          if (initialUser) setUser(initialUser);

          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((error) => {
          console.error("Ошибка авторизации:", error);
          isCodeProcessed.current = false; 
        });
    }
  }, [setToken, setUser]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, [setToken, setUser]);

  return { isLoading: isTokenLoading, login, logout, token, user };
};