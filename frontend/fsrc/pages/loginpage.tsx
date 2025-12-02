import { useState } from "react";
import { supabase } from "../services/supabase";
import { useNavigate } from "react-router-dom";
import { useSetUserId } from "../hooks/useLuqoStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const setUserId = useSetUserId();

  async function handleLogin() {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });
    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    const token = data.session?.access_token;
    if (!token) {
      alert("セッションが取得できませんでした");
      return;
    }

    const user = data.user;
    if (user?.id) {
      setUserId(user.id);
      localStorage.setItem("luqo_user_id", user.id);
    }

    // アクセストークンを保存（MVPはこれでOK）
    localStorage.setItem("session_token", token);
    window.location.href = "/";
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2 className="login-title">LUQO Core</h2>
        <p className="text-muted" style={{ textAlign: "center", marginTop: "-1rem", marginBottom: "1rem" }}>
          Sign in to your account
        </p>

        <div className="field">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="field">
          <input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button
          className="btn btn--primary"
          style={{ marginTop: "0.5rem" }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}
