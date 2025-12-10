import { useState, useEffect } from "react";

/**
 * レトロゲームモードの状態を監視するカスタムフック
 */
export function useRetroGameMode() {
  const [isRetroGameMode, setIsRetroGameMode] = useState(false);

  useEffect(() => {
    const checkRetroMode = () => {
      setIsRetroGameMode(document.body.classList.contains("retro-game"));
    };

    // 初回チェック
    checkRetroMode();

    // MutationObserverでbodyクラスの変更を監視
    const observer = new MutationObserver(checkRetroMode);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return isRetroGameMode;
}

