import React, { useState, useEffect } from "react";
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
import { WelcomeVideo } from "./components/WelcomeVideo";
import "./App.css";

// 初回ログイン検知用のフラグキー
const WELCOME_VIDEO_FLAG = "luqo_has_seen_welcome_video";
const WELCOME_VIDEO_PATH = "/welcome-video.mp4"; // publicディレクトリに配置する動画ファイル

// 認証が必要なページをラップするコンポーネント
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // 初回ログインかどうかをチェック
    const hasSeenVideo = localStorage.getItem(WELCOME_VIDEO_FLAG);
    
    // フラグがなければ初回ログインと判断
    if (!hasSeenVideo) {
      setShowWelcomeVideo(true);
    }
    
    setIsChecking(false);
  }, [isAuthenticated]);

  const handleVideoComplete = () => {
    // 動画再生完了後、フラグを設定
    localStorage.setItem(WELCOME_VIDEO_FLAG, "true");
    setShowWelcomeVideo(false);
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 初回ログイン時は動画を表示
  if (showWelcomeVideo) {
    return (
      <WelcomeVideo
        videoPath={WELCOME_VIDEO_PATH}
        onComplete={handleVideoComplete}
      />
    );
  }

  // チェック中は何も表示しない（フラッシュを防ぐ）
  if (isChecking) {
    return null;
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



