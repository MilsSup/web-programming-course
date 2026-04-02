import { useCallback, useEffect, useRef } from 'react';
import { useLocalStorageWithSubscription } from './useLocalStorageWithSubscription';
import { getApiAuthGithubCallback } from '../../../generated/api/auth/auth';

const GITHUB_CLIENT_ID = 'Ov23lieQV5VzylgzlWhm'; 

export const useAuth = () => {
  const { isLoading, data: token, setValue } = useLocalStorageWithSubscription('auth_token');
  
  // предохранитель от двойного срабатывания React Strict Mode
  const isCodeProcessed = useRef(false);

  const login = useCallback(() => {
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}`;
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    // Проверяем: есть ли код И не обрабатывали ли мы его уже?
    if (code && !isCodeProcessed.current) {
      // Сразу защелкиваем предохранитель!
      isCodeProcessed.current = true; 

      getApiAuthGithubCallback({ code })
        .then(({ token }) => {
          setValue(token);
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((error) => {
          console.error("Ошибка при обмене кода на токен:", error);
          // Если реально произошла ошибка, снимаем предохранитель, чтобы можно было попробовать снова
          isCodeProcessed.current = false; 
        });
    }
  }, [setValue]);

  const logout = useCallback(() => {
    setValue(null);
  }, [setValue]);

  return { isLoading, login, logout, token };
};