import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { apiClient } from "../lib/apiClient";
import { Icon } from "../components/ui/Icon";
import { useSnackbar } from "../contexts/SnackbarContext";
import { useNavigate } from "react-router-dom";

type Client = { id: string; name: string };

// Android風リストアイテムコンポーネント
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
    style={{
      display: "flex",
      alignItems: "center",
      gap: "16px",
      padding: "16px 24px",
      cursor: onClick ? "pointer" : "default",
      transition: "background 0.2s",
      borderBottom: "1px solid #f1f5f9", // Divider
    }}
    onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = "#f8fafc"; }}
    onMouseLeave={(e) => { if (onClick) e.currentTarget.style.background = "transparent"; }}
  >
    <div style={{ color: destructive ? "#b3261e" : "#475569", display: "flex" }}>
      <Icon name={icon} size={24} />
    </div>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
      <span style={{ fontSize: "16px", color: destructive ? "#b3261e" : "#1e293b", fontWeight: 500 }}>{title}</span>
      {subtitle && <span style={{ fontSize: "13px", color: "#64748b" }}>{subtitle}</span>}
    </div>
    {action && <div>{action}</div>}
  </div>
);

// セクションヘッダー
const SettingsSectionHeader = ({ title }: { title: string }) => (
  <div style={{
    padding: "24px 24px 8px",
    fontSize: "14px",
    fontWeight: 700,
    color: "#00639b", // Primary Color
    letterSpacing: "0.5px"
  }}>
    {title}
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
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#00639b", marginBottom: "8px", marginLeft: "4px" }}>
      {label}
    </label>
    <div style={{
      background: "#f0f9ff", borderRadius: "16px",
      border: "1px solid #cce3de", transition: "all 0.2s ease",
      display: "flex", alignItems: "center",
      padding: "6px 8px 6px 16px",
      gap: "12px"
    }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: "8px 0", border: "none",
          background: "transparent", fontSize: "16px", fontWeight: "600",
          color: "#1e293b", outline: "none", minWidth: 0
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
        <Icon name="pen" size={18} color="#00639b" style={{ opacity: 0.7 }} />
        {action}
      </div>
    </div>
  </div>
);

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [newClientName, setNewClientName] = useState("");
  const [isAddingClient, setIsAddingClient] = useState(false); // 入力モード切替用
  const [displayName, setDisplayName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);

  const { showSnackbar } = useSnackbar();

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
    loadClients();
    loadProfile();
  }, []);

  const loadClients = async () => {
    try {
      const res = await apiClient.get<{ clients: Client[] }>("/api/v1/master/clients");
      if (res?.clients) setClients(res.clients);
    } catch (error) {
      showSnackbar("取引先の取得に失敗しました", "error");
    }
  };

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
      const errorMessage = e?.message || "更新に失敗しました";
      showSnackbar(errorMessage, "error");
      console.error("Profile update error:", e);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const res = await apiClient.post<{ ok: boolean; client: Client }>("/api/v1/master/clients", { name: newClientName });
      if (res?.ok && res.client) {
        setClients((prev) => [...prev, res.client]);
        setNewClientName("");
        setIsAddingClient(false);
        showSnackbar("取引先を追加しました", "success");
      }
    } catch (error) {
      showSnackbar("追加失敗", "error");
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm("削除してよろしいですか？")) return;
    try {
      await apiClient.delete(`/api/v1/master/clients/${id}`);
      setClients((prev) => prev.filter((c) => c.id !== id));
      showSnackbar("削除しました", "info");
    } catch (error) {
      showSnackbar("削除失敗", "error");
    }
  };

  return (
    <div style={{ paddingBottom: "80px", maxWidth: "800px", margin: "0 auto" }}>

      {/* プロフィール設定セクション */}
      <SettingsSectionHeader title="プロフィール設定" />
      <div style={{
        background: "white", borderRadius: "24px",
        padding: "24px", margin: "0 16px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
      }}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "24px",
            background: "#e0f2fe", color: "#00639b",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "24px", flexShrink: 0
          }}>
            {displayName ? displayName[0] : "U"}
          </div>

          <div style={{ flex: 1 }}>
            <ExpressiveInput
              label="表示名 (Display Name)"
              value={displayName}
              onChange={setDisplayName}
              placeholder="例: 山田 太郎"
              action={
                <button
                  onClick={handleSaveProfile}
                  disabled={loadingProfile}
                  style={{
                    background: "#00639b",
                    color: "white",
                    padding: "8px 16px",
                    borderRadius: "12px",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: loadingProfile ? "default" : "pointer",
                    boxShadow: "0 2px 4px rgba(0,99,155,0.2)",
                    transition: "transform 0.2s",
                    whiteSpace: "nowrap"
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  {loadingProfile ? "..." : "保存"}
                </button>
              }
            />
          </div>
        </div>
      </div>

      {/* 2. アカウントセクション */}
      <SettingsSectionHeader title="アカウント" />
      <div style={{ background: "white", borderRadius: "24px", overflow: "hidden", margin: "0 16px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
        <SettingsItem
          icon="guardian" // User icon substitute
          title="メールアドレス"
          subtitle={email ?? "読み込み中..."}
        />
        <div style={{ padding: "16px 24px", display: "flex", gap: "8px", alignItems: "center", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ color: "#475569" }}><Icon name="lock" size={24} /></div>
          <div style={{ flex: 1 }}>
            <input
              type="password"
              placeholder="新しいパスワードを入力"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: "100%", border: "none", outline: "none", fontSize: "16px", background: "transparent"
              }}
            />
          </div>
          <button
            onClick={handleUpdatePassword}
            disabled={!newPassword}
            style={{
              background: newPassword ? "#00639b" : "#e2e8f0",
              color: "white", border: "none", padding: "8px 16px", borderRadius: "100px", fontWeight: 700, cursor: newPassword ? "pointer" : "default"
            }}
          >
            変更
          </button>
        </div>
      </div>

      {/* 3. マスタ管理セクション */}
      <SettingsSectionHeader title="マスタ・評価基準" />
      <div style={{ background: "white", borderRadius: "24px", overflow: "hidden", margin: "0 16px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
        <SettingsItem
          icon="star"
          title="技術評価基準 (T-Score)"
          subtitle="スキルの定義確認・追加提案・投票"
          onClick={() => navigate("/settings/stars")}
          action={<span style={{ color: "#cbd5e1" }}>▶</span>}
        />
        <div style={{ height: 1, background: "#f1f5f9", margin: "0 24px" }} />
      </div>

      <SettingsSectionHeader title="取引先マスタ" />
      <div style={{ background: "white", borderRadius: "24px", overflow: "hidden", margin: "0 16px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>

        {/* 追加ボタン / 入力フォーム */}
        {isAddingClient ? (
          <div style={{ padding: "16px 24px", display: "flex", gap: "8px", alignItems: "center", background: "#f0f9ff" }}>
            <input
              autoFocus
              type="text"
              placeholder="取引先名を入力..."
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              style={{ flex: 1, border: "none", background: "transparent", fontSize: "16px", outline: "none" }}
            />
            <button onClick={() => setIsAddingClient(false)} style={{ border: "none", background: "transparent", color: "#64748b", fontWeight: 700, cursor: "pointer" }}>キャンセル</button>
            <button onClick={handleAddClient} style={{ background: "#00639b", color: "white", border: "none", padding: "8px 16px", borderRadius: "100px", fontWeight: 700, cursor: "pointer" }}>保存</button>
          </div>
        ) : (
          <SettingsItem
            icon="pen" // Add icon substitute
            title="新しい取引先を追加"
            onClick={() => setIsAddingClient(true)}
            action={<span style={{ fontSize: "24px", color: "#00639b" }}>+</span>}
          />
        )}

        {/* リスト */}
        {clients.map((client) => (
          <SettingsItem
            key={client.id}
            icon="info" // Building icon substitute
            title={client.name}
            action={
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id); }}
                style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", padding: "8px" }}
              >
                <Icon name="trash" size={20} />
              </button>
            }
          />
        ))}
        {clients.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>登録されている取引先はありません</div>
        )}
      </div>

      <div style={{ height: "40px" }} />

      {/* 4. その他 */}
      <div style={{ margin: "0 16px" }}>
        <button
          onClick={() => {
            localStorage.removeItem("session_token");
            window.location.href = "/login";
          }}
          style={{
            width: "100%", padding: "16px", borderRadius: "100px",
            border: "1px solid #fee2e2", background: "#fef2f2",
            color: "#b91c1c", fontWeight: 700, fontSize: "16px", cursor: "pointer"
          }}
        >
          ログアウト
        </button>
        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "12px", color: "#94a3b8" }}>
          LUQO Core v1.0.1
        </p>
      </div>

    </div>
  );
};

export default SettingsPage;
