import { useState, useEffect } from "react";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem("session_token");
  });

  useEffect(() => {
    // 初回チェック
    const checkAuth = () => {
      const token = localStorage.getItem("session_token");
      setIsAuthenticated(!!token);
    };

    // ストレージイベント（別タブでの変更を検知）
    window.addEventListener("storage", checkAuth);
    
    // 同じウィンドウ内でのlocalStorage変更を検知するためのカスタムイベント
    const handleStorageChange = () => {
      checkAuth();
    };
    
    // カスタムイベントをリッスン（ログインページから発火される）
    window.addEventListener("auth-changed", handleStorageChange);

    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("auth-changed", handleStorageChange);
    };
  }, []);

  return { isAuthenticated };
}
