import React from "react";
import { NavLink } from "react-router-dom";

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

        <nav className="app-shell__nav">
          <NavLink to="/" end className="app-shell__link">
            ダッシュボード
          </NavLink>

          <NavLink to="/settings" className="app-shell__link">
            設定
          </NavLink>

          <button onClick={handleLogout} className="app-shell__link">
            ログアウト
          </button>
        </nav>
      </header>

      <main className="app-shell__main">{children}</main>
    </div>
  );
};

export default AppShell;
