import { Router } from "express";
import type { AuthedRequest } from "../types/authed-request";

const userRouter = Router();

// GET /api/v1/user/profile
// 自分のプロフィールを取得
userRouter.get("/profile", async (req, res) => {
  const r = req as AuthedRequest;
  try {
    const { data, error } = await r.supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", r.userId)
      .single();

    // データが見つからない場合（トリガー作成前のユーザーなど）はエラーにせず空で返す手もあるが、
    // 基本的にはトリガーで作成されている前提。
    if (error) {
      console.warn("Profile fetch error:", error.message);
      // プロフィールがない場合は404にせず、最低限の情報を返すフォールバック
      return res.json({ ok: true, profile: { id: r.userId, name: "" } });
    }

    res.json({ ok: true, profile: data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/v1/user/profile
// プロフィール（名前）更新
userRouter.post("/profile", async (req, res) => {
  const r = req as AuthedRequest;
  const { name } = req.body;

  if (typeof name !== "string") {
    return res.status(400).json({ ok: false, error: "Name is required" });
  }

  if (!name.trim()) {
    return res.status(400).json({ ok: false, error: "Name cannot be empty" });
  }

  try {
    // まず既存のプロフィールを確認
    const { data: existing, error: fetchError } = await r.supabase
      .from("profiles")
      .select("id")
      .eq("id", r.userId)
      .single();

    let result;
    if (fetchError || !existing) {
      // プロフィールが存在しない場合は新規作成
      const { data, error } = await r.supabase
        .from("profiles")
        .insert({
          id: r.userId,
          name: name.trim(),
        })
        .select()
        .single();

      if (error) {
        console.error("Profile insert error:", error);
        return res.status(500).json({ 
          ok: false, 
          error: `Failed to create profile: ${error.message}` 
        });
      }
      result = data;
    } else {
      // プロフィールが存在する場合は更新
      const { data, error } = await r.supabase
        .from("profiles")
        .update({
          name: name.trim(),
        })
        .eq("id", r.userId)
        .select()
        .single();

      if (error) {
        console.error("Profile update error:", error);
        return res.status(500).json({ 
          ok: false, 
          error: `Failed to update profile: ${error.message}` 
        });
      }
      result = data;
    }

    res.json({ ok: true, message: "Profile updated", profile: result });
  } catch (err: any) {
    console.error("Profile update exception:", err);
    res.status(500).json({ 
      ok: false, 
      error: err?.message || "Failed to update profile" 
    });
  }
});

// POST /api/v1/user/profiles
// 複数のユーザーIDからプロフィール（名前）を取得
userRouter.post("/profiles", async (req, res) => {
  const r = req as AuthedRequest;
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ ok: false, error: "userIds must be a non-empty array" });
  }

  try {
    const { data, error } = await r.supabase
      .from("profiles")
      .select("id, name")
      .in("id", userIds);

    if (error) {
      console.error("Profiles fetch error:", error);
      return res.status(500).json({ 
        ok: false, 
        error: `Failed to fetch profiles: ${error.message}` 
      });
    }

    // userIdをキーとしたマップを作成（名前がない場合はuserIdを返す）
    const profileMap: Record<string, string> = {};
    userIds.forEach((id: string) => {
      const profile = data?.find((p) => p.id === id);
      profileMap[id] = profile?.name || id; // 名前がない場合はuserIdをそのまま使用
    });

    res.json({ ok: true, profiles: profileMap });
  } catch (err: any) {
    console.error("Profiles fetch exception:", err);
    res.status(500).json({ 
      ok: false, 
      error: err?.message || "Failed to fetch profiles" 
    });
  }
});

export default userRouter;
