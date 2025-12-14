import React, { useState, useEffect, useRef } from "react";
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
import WorkCategoryEditPage from "./pages/WorkCategoryEditPage";
import { SnackbarProvider } from "./contexts/SnackbarContext";
import { ConfirmDialogProvider } from "./contexts/ConfirmDialogContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ModalProvider } from "./contexts/ModalContext";
import { WelcomeVideo } from "./components/WelcomeVideo";
import { initializeSupabaseSession } from "./services/supabase";
import "./App.css";

// 初回ログイン検知用のフラグキー
const WELCOME_VIDEO_FLAG = "luqo_has_seen_welcome_video";
const WELCOME_VIDEO_PATH = "/welcom_video.mp4"; // publicディレクトリに配置する動画ファイル（実際のファイル名に合わせる）

// 認証が必要なページをラップするコンポーネント
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell>{children}</AppShell>;
};

const App: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);
  // セッション中に既に動画をチェック/表示したかを追跡（React.StrictModeや複数回マウントを防ぐ）
  const SESSION_CHECK_FLAG = "luqo_welcome_video_session_checked";
  const hasCheckedRef = useRef(false);

  // アプリ起動時にSupabaseセッションを初期化
  useEffect(() => {
    void initializeSupabaseSession();
  }, []);

  // アプリレベルで動画表示を管理（認証状態が変わった時、または初回マウント時に1回だけチェック）
  useEffect(() => {
    // 認証状態が確定するまで待つ
    if (!isAuthenticated) {
      return;
    }

    // 既にこのセッションでチェック済みの場合はスキップ（React.StrictModeによる2回実行を防ぐ）
    if (hasCheckedRef.current || sessionStorage.getItem(SESSION_CHECK_FLAG)) {
      return;
    }

    // セッション中にチェック済みフラグを設定
    hasCheckedRef.current = true;
    sessionStorage.setItem(SESSION_CHECK_FLAG, "true");

    // 初回ログインかどうかをチェック（localStorageで永続化）
    const hasSeenVideo = localStorage.getItem(WELCOME_VIDEO_FLAG);
    
    // フラグがなければ初回ログインと判断
    if (!hasSeenVideo) {
      console.log("[WelcomeVideo] 初回ログインを検出。動画を表示します。");
      setShowWelcomeVideo(true);
    } else {
      console.log("[WelcomeVideo] 既に動画を見たことがあります。スキップします。");
    }
  }, [isAuthenticated]);

  const handleVideoComplete = () => {
    // 動画再生完了後、フラグを設定（永続化）
    localStorage.setItem(WELCOME_VIDEO_FLAG, "true");
    setShowWelcomeVideo(false);
  };

  return (
    <SnackbarProvider>
      <ConfirmDialogProvider>
        <NotificationProvider>
          <ModalProvider>
            {/* 動画が表示中の場合、動画のみを表示 */}
            {showWelcomeVideo ? (
              <WelcomeVideo
                videoPath={WELCOME_VIDEO_PATH}
                onComplete={handleVideoComplete}
              />
            ) : (
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
              path="/settings/work-categories"
              element={
                <ProtectedRoute>
                  <WorkCategoryEditPage />
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
            )}
          </ModalProvider>
        </NotificationProvider>
      </ConfirmDialogProvider>
    </SnackbarProvider>
  );
};

export default App;



