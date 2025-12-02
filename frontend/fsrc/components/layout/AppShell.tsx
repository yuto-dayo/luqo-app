import React from "react";
import { NavLink } from "react-router-dom";
import { NotificationBell } from "../NotificationBell";

type Props = {
  children: React.ReactNode;
};

const AppShell: React.FC<Props> = ({ children }) => {
  const handleLogout = () => {
    localStorage.removeItem("session_token");
    window.location.href = "/login";
  };

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <span className="app-shell__title">LUQO Core</span>
        </div>

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

          <button onClick={handleLogout} className="app-shell__link">
            ログアウト
          </button>
        </div>
      </header>

      <main className="app-shell__main">{children}</main>
    </div>
  );
};

export default AppShell;
