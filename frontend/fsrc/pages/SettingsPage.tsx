import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../services/supabase";
import { apiClient } from "../lib/apiClient";
import { Icon } from "../components/ui/Icon";
import { useSnackbar } from "../contexts/SnackbarContext";
import { useNavigate } from "react-router-dom";
import styles from "./SettingsPage.module.css";

// 設定アイテムコンポーネント
const SettingsItem = ({
  icon,
  title,
  subtitle,
  onClick,
  action,
  destructive = false
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  action?: React.ReactNode;
  destructive?: boolean;
}) => (
  <div
    onClick={onClick}
    className={`${styles.settingsItem} ${destructive ? styles.settingsItemDestructive : ""}`}
  >
    <div className={styles.settingsItemIcon}>
      <Icon name={icon} size={24} />
    </div>
    <div className={styles.settingsItemContent}>
      <span className={styles.settingsItemTitle}>{title}</span>
      {subtitle && <span className={styles.settingsItemSubtitle}>{subtitle}</span>}
    </div>
    {action && <div className={styles.settingsItemAction}>{action}</div>}
  </div>
);

// セクションヘッダー
const SettingsSectionHeader = ({
  title,
  onClick,
  isExpanded
}: {
  title: string;
  onClick?: () => void;
  isExpanded?: boolean;
}) => (
  <div
    onClick={onClick}
    className={styles.sectionHeader}
    style={{ cursor: onClick ? "pointer" : "default" }}
  >
    <span>{title}</span>
    {onClick && (
      <Icon
        name={isExpanded ? "chevronUp" : "chevronDown"}
        size={16}
        color="var(--color-seed)"
      />
    )}
  </div>
);

// Expressiveな入力フィールド
const ExpressiveInput = ({
  label,
  value,
  onChange,
  placeholder,
  action
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  action?: React.ReactNode;
}) => (
  <div className={styles.inputGroup}>
    <label className={styles.inputLabel}>
      {label}
    </label>
    <div className={styles.inputWrapper}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.inputField}
      />
      <div className={styles.inputAction}>
        <Icon name="edit" size={18} color="var(--color-seed)" style={{ opacity: 0.7 }} />
        {action}
      </div>
    </div>
  </div>
);

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const { showSnackbar } = useSnackbar();

  // 現在の月を取得（YYYY-MM形式）
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  // localStorageをクリアしてリロード
  const handleClearLocalStorage = () => {
    const currentMonth = getCurrentMonth();
    localStorage.removeItem("luqo.banditMission.v1");
    localStorage.removeItem(`luqo.score.v1.${currentMonth}`);
    showSnackbar("キャッシュをクリアしました。ページをリロードします...", "success");
    setTimeout(() => {
      location.reload();
    }, 500);
  };

  const loadProfile = async () => {
    try {
      const res = await apiClient.get<{ ok: boolean; profile: { id: string; name: string } }>("/api/v1/user/profile");
      if (res.ok && res.profile) {
        setDisplayName(res.profile.name || "");
      }
    } catch (e) {
      console.error(e);
    }
  };


  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    };
    fetchUser();
    loadProfile();
  }, []);


  const handleUpdatePassword = async () => {
    if (!newPassword) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      showSnackbar(`変更失敗: ${error.message}`, "error");
    } else {
      showSnackbar("パスワードを更新しました", "success");
      setNewPassword("");
    }
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return;
    setLoadingProfile(true);
    try {
      const res = await apiClient.post<{ ok: boolean; error?: string; message?: string }>("/api/v1/user/profile", {
        name: displayName
      });
      if (res.ok) {
        showSnackbar("表示名を更新しました！", "success");
      } else {
        // バックエンドが ok: false を返した場合
        const errorMessage = res.error || "更新に失敗しました";
        showSnackbar(errorMessage, "error");
        console.error("Profile update failed:", res);
      }
    } catch (e: any) {
      // ネットワークエラーやHTTPエラーの場合
      console.error("Profile update error:", e);
      console.error("Profile update error details:", {
        message: e?.message,
        stack: e?.stack,
        response: e?.response
      });
      const errorMessage = e?.message || "更新に失敗しました";
      showSnackbar(errorMessage, "error");
    } finally {
      setLoadingProfile(false);
    }
  };


  return (
    <div className={styles.container}>
      {/* プロフィール設定セクション */}
      <SettingsSectionHeader title="プロフィール設定" />
      <div className={styles.cardContainer}>
        <div className={styles.profileSection}>
          <div className={styles.avatar}>
            {displayName ? displayName[0] : "U"}
          </div>

          <div className={styles.profileForm}>
            <ExpressiveInput
              label="表示名 (Display Name)"
              value={displayName}
              onChange={setDisplayName}
              placeholder="例: 山田 太郎"
              action={
                <button
                  onClick={handleSaveProfile}
                  disabled={loadingProfile}
                  className={styles.saveButton}
                >
                  {loadingProfile ? "..." : "保存"}
                </button>
              }
            />
          </div>
        </div>
      </div>

      {/* アカウントセクション */}
      <SettingsSectionHeader title="アカウント" />
      <div className={styles.cardContainer}>
        <SettingsItem
          icon="guardian"
          title="メールアドレス"
          subtitle={email ?? "読み込み中..."}
        />
        <div className={styles.passwordInputSection}>
          <div className={styles.settingsItemIcon}>
            <Icon name="lock" size={24} />
          </div>
          <div className={styles.passwordInputWrapper}>
            <input
              type="password"
              placeholder="新しいパスワードを入力"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.passwordInput}
            />
          </div>
          <button
            onClick={handleUpdatePassword}
            disabled={!newPassword}
            className={styles.passwordButton}
          >
            変更
          </button>
        </div>
      </div>

      {/* マスタ管理セクション */}
      <SettingsSectionHeader title="マスタ・評価基準" />
      <div className={styles.cardContainer}>
        <SettingsItem
          icon="star"
          title="技術評価基準 (T-Score)"
          subtitle="スキルの定義確認・追加提案・投票"
          onClick={() => navigate("/settings/stars")}
          action={<span className={styles.settingsItemAction}>▶</span>}
        />
        <div className={styles.separator} />
        <SettingsItem
          icon="info"
          title="取引先マスタ"
          subtitle="取引先の追加・編集・削除"
          onClick={() => navigate("/settings/clients")}
          action={<span className={styles.settingsItemAction}>▶</span>}
        />
      </div>

      {/* 工事カテゴリ設定セクション */}
      <SettingsSectionHeader title="工事カテゴリ設定" />
      <div className={styles.cardContainer}>
        <SettingsItem
          icon="info"
          title="工事カテゴリ編集"
          subtitle="カテゴリの追加・編集・削除・重み係数設定"
          onClick={() => navigate("/settings/work-categories")}
          action={<span className={styles.settingsItemAction}>▶</span>}
        />
      </div>

      {/* 高度な設定（デバッグ・開発者向け） */}
      <SettingsSectionHeader
        title="高度な設定"
        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
        isExpanded={isAdvancedOpen}
      />
      {isAdvancedOpen && (
        <div className={styles.cardContainer}>
          <SettingsItem
            icon="info"
            title="キャッシュをクリア"
            subtitle="バンディットミッションとスコアのキャッシュを削除してリロード"
            onClick={handleClearLocalStorage}
            destructive={false}
          />
        </div>
      )}

      {/* その他 */}
      <div>
        <button
          onClick={() => {
            localStorage.removeItem("session_token");
            window.location.href = "/login";
          }}
          className={styles.logoutButton}
        >
          ログアウト
        </button>
        <p className={styles.versionInfo}>
          LUQO Core v1.0.1
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;
