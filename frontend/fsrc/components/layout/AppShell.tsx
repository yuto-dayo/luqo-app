import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { NotificationBell, NotificationList } from "../NotificationBell";
import { useResponsive } from "../../hooks/useResponsive";
import { useNotificationContext } from "../../contexts/NotificationContext";
import { Icon } from "../ui/Icon";
import ClickSpark from "../ClickSpark";
import styles from "./AppShell.module.css";

type Props = {
  children: React.ReactNode;
};

const STORAGE_KEY = "luqo_retro_game_mode";

const AppShell: React.FC<Props> = ({ children }) => {
  const { isMobile } = useResponsive();
  const { count } = useNotificationContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRetroGameMode, setIsRetroGameMode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Retro Game Modeの初期化（localStorageから読み込み）
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "true") {
      setIsRetroGameMode(true);
      document.body.classList.add("retro-game");
    } else {
      document.body.classList.remove("retro-game");
      document.body.classList.remove("retro-glitch"); // 旧モード削除
    }
  }, []);

  // Mode切り替え
  const handleToggleRetroMode = () => {
    setIsTransitioning(true);
    
    // トランジションエフェクト（画面フラッシュ）
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #ffffff;
      z-index: 99999;
      pointer-events: none;
      animation: fadeIn 0.2s ease-out;
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
      const newMode = !isRetroGameMode;
      setIsRetroGameMode(newMode);
      localStorage.setItem(STORAGE_KEY, String(newMode));

      if (newMode) {
        document.body.classList.add("retro-game");
      } else {
        document.body.classList.remove("retro-game");
      }

      setTimeout(() => {
        document.body.removeChild(overlay);
        setIsTransitioning(false);
      }, 200);
    }, 100);
  };

  // メニューが開いている時にbodyのスクロールを無効化
  useEffect(() => {
    if (isMenuOpen && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    // クリーンアップ: コンポーネントがアンマウントされる時にも確実に解除
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen, isMobile]);

  // メニューを閉じる処理
  const handleCloseMenu = () => {
    setIsMenuOpen(false);
  };

  // リンククリック時にメニューを閉じる
  const handleLinkClick = () => {
    if (isMobile) {
      setIsMenuOpen(false);
    }
  };

  return (
    <div className="app-shell">
      {/* オーバーレイ（メニューが開いている時、headerの外に配置） */}
      {isMobile && isMenuOpen && (
        <div
          className={styles.overlay}
          onClick={handleCloseMenu}
          onTouchEnd={handleCloseMenu}
          aria-hidden="true"
        />
      )}

      <header className="app-shell__header">
        <div className="app-shell__brand">
          <span 
            className="app-shell__title" 
            onClick={handleToggleRetroMode}
            style={{ cursor: "pointer", userSelect: "none" }}
            title="Click to Start Adventure!"
          >
            LUQO Core
          </span>
        </div>

        {/* デスクトップ: 通常のナビゲーション */}
        {!isMobile && (
          <div className="app-shell__nav">
            <NotificationBell />
            <NavLink to="/" end className="app-shell__link">
              ダッシュボード
            </NavLink>
            <NavLink to="/accounting" className="app-shell__link">
              経理 (Ops)
            </NavLink>
            <NavLink to="/settings" className="app-shell__link">
              設定
            </NavLink>
          </div>
        )}

        {/* モバイル: ハンバーガーボタン */}
        {isMobile && (
          <button
            className={`${styles.hamburgerButton} ${count > 0 ? styles.hasNotification : ""}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="メニューを開く"
          >
            <Icon
              name={isMenuOpen ? "close" : "menu"}
              size={24}
              color="var(--color-text-main)"
            />
            {/* 通知がある場合のバッジ（赤いドット） */}
            {count > 0 && <span className={styles.notificationBadge} />}
          </button>
        )}
      </header>

      {/* モバイルメニュー（headerの外に配置） */}
      {isMobile && (
        <nav
          className={`${styles.mobileMenu} ${
            isMenuOpen ? styles.mobileMenuOpen : ""
          }`}
          onClick={(e) => {
            // ドロワー内をクリックした時は閉じないようにイベント伝播を止める
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            // ドロワー内をタッチした時は閉じないようにイベント伝播を止める
            e.stopPropagation();
          }}
        >
          <div className={styles.mobileMenuContent}>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `${styles.mobileLink} ${isActive ? styles.active : ""}`
              }
              onClick={handleLinkClick}
            >
              ダッシュボード
            </NavLink>
            <NavLink
              to="/accounting"
              className={({ isActive }) =>
                `${styles.mobileLink} ${isActive ? styles.active : ""}`
              }
              onClick={handleLinkClick}
            >
              経理 (Ops)
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `${styles.mobileLink} ${isActive ? styles.active : ""}`
              }
              onClick={handleLinkClick}
            >
              設定
            </NavLink>
            {/* モバイルメニュー内の通知リスト */}
            <div className={styles.mobileNotification}>
              <div
                style={{
                  background: "var(--color-surface, #fff)",
                  borderRadius: "16px",
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                }}
              >
                <NotificationList alwaysExpanded={true} />
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className="app-shell__main">{children}</main>
      
      {/* Retro Game Components */}
      <ClickSpark isActive={isRetroGameMode && !isTransitioning} />
    </div>
  );
};

export default AppShell;
