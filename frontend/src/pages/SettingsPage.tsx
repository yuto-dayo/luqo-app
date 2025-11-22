import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const SettingsPage: React.FC = () => {
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ログイン中ユーザー取得
  useEffect(() => {
    async function fetchUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        setStatus(`ユーザー情報の取得に失敗しました：${error.message}`);
        return;
      }
      setEmail(data.user?.email ?? null);
    }
    fetchUser();
  }, []);

  // パスワード更新
  async function handleUpdatePassword() {
    if (!newPassword) return;

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setLoading(false);

    if (error) {
      setStatus(`パスワード変更に失敗しました：${error.message}`);
    } else {
      setStatus("パスワードを更新しました。");
      setNewPassword("");
    }
  }

  return (
    <div className="page">
      <section className="card">
        <header className="card__header">
          <div>
            <p className="card__eyebrow">Settings</p>
            <h2 className="card__title">環境設定</h2>
          </div>
        </header>

        {/* アカウント情報 */}
        <div style={{ marginTop: 16, fontSize: 14, color: "#4b5563" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            アカウント情報
          </h3>
          <p>メールアドレス：{email ?? "取得中..."}</p>
        </div>

        {/* パスワード変更 */}
        <div style={{ marginTop: 24, fontSize: 14, color: "#4b5563" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            パスワード変更
          </h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="password"
              placeholder="新しいパスワード"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ padding: 4, flex: 1 }}
            />
            <button onClick={handleUpdatePassword} disabled={loading}>
              {loading ? "更新中..." : "変更"}
            </button>
          </div>
        </div>

        {/* ステータス表示 */}
        {status && (
          <p style={{ marginTop: 16, fontSize: 13, color: "#6b7280" }}>
            {status}
          </p>
        )}
      </section>
    </div>
  );
};

export default SettingsPage;
