import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import AppShell from "./components/layout/AppShell";
import LoginPage from "./pages/loginpage";
import DashboardPage from "./pages/DashboardPage";
import AccountingPage from "./pages/AccountingPage";
import SettingsPage from "./pages/SettingsPage";
import TScorePage from "./pages/TScorePage";
import StarSettingsPage from "./pages/StarSettingsPage";
import PaymasterPage from "./pages/PaymasterPage";
import ClientMasterPage from "./pages/ClientMasterPage";
import { SnackbarProvider } from "./contexts/SnackbarContext";
import { ConfirmDialogProvider } from "./contexts/ConfirmDialogContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ModalProvider } from "./contexts/ModalContext";
import "./App.css";

// 認証が必要なページをラップするコンポーネント
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell>{children}</AppShell>;
};

const App: React.FC = () => {
  return (
    <SnackbarProvider>
      <ConfirmDialogProvider>
        <NotificationProvider>
          <ModalProvider>
            <BrowserRouter>
          <Routes>
            {/* ログインページ（認証不要） */}
            <Route path="/login" element={<LoginPage />} />

            {/* 認証が必要なページ */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accounting"
              element={
                <ProtectedRoute>
                  <AccountingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tscore"
              element={
                <ProtectedRoute>
                  <TScorePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tscore/:userId"
              element={
                <ProtectedRoute>
                  <TScorePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/star-settings"
              element={
                <ProtectedRoute>
                  <StarSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/stars"
              element={
                <ProtectedRoute>
                  <StarSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/clients"
              element={
                <ProtectedRoute>
                  <ClientMasterPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/paymaster"
              element={
                <ProtectedRoute>
                  <PaymasterPage />
                </ProtectedRoute>
              }
            />

            {/* 未定義のルートはダッシュボードにリダイレクト */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
          </ModalProvider>
        </NotificationProvider>
      </ConfirmDialogProvider>
    </SnackbarProvider>
  );
};

export default App;



