import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/loginpage";
import AppShell from "./components/layout/AppShell";
import { useAuth } from "./hooks/useAuth";
import "./App.css";
import "./styles/global.css";

import TScorePage from "./pages/TScorePage";
import AccountingPage from "./pages/AccountingPage";
import { SnackbarProvider } from "./contexts/SnackbarContext";
import { ConfirmDialogProvider } from "./contexts/ConfirmDialogContext";
import { supabase } from "./services/supabase";
import { useSetUserId } from "./hooks/useLuqoStore";
import StarSettingsPage from "./pages/StarSettingsPage";

// 保護されたルートのレイアウト
const ProtectedLayout = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

export default function App() {
  const { isAuthenticated } = useAuth();
  const setUserId = useSetUserId();

  // 認証状態変化に追随してトークンとユーザーIDを同期
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          if (session?.access_token) {
            localStorage.setItem("session_token", session.access_token);
          }
          if (session?.user?.id) {
            setUserId(session.user.id);
            localStorage.setItem("luqo_user_id", session.user.id);
          }
        } else if (event === "SIGNED_OUT") {
          localStorage.removeItem("session_token");
          localStorage.removeItem("luqo_user_id");
          setUserId(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUserId]);

  return (
    <SnackbarProvider>
      <ConfirmDialogProvider>
        <BrowserRouter>
          <Routes>
            {/* ログインページ */}
            <Route
              path="/login"
              element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
            />

            {/* 保護されたルート */}
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/t-score/:userId?" element={<TScorePage />} />
              <Route path="/accounting" element={<AccountingPage />} />
              <Route path="/settings/stars" element={<StarSettingsPage />} />
            </Route>

            {/* 404 / Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfirmDialogProvider>
    </SnackbarProvider>
  );
}
