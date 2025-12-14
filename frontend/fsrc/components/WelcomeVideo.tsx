import React, { useState, useEffect, useRef } from "react";
import { useRetroGameMode } from "../hooks/useRetroGameMode";
import styles from "./WelcomeVideo.module.css";

type Props = {
  videoPath: string;
  onComplete: () => void;
  onSkip?: () => void;
};

/**
 * 初回ログイン時に表示されるウェルカム動画コンポーネント
 * 動画再生完了後、またはスキップ時にonCompleteを呼び出す
 */
export const WelcomeVideo: React.FC<Props> = ({ videoPath, onComplete, onSkip }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isRetroGameMode = useRetroGameMode();
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 動画の読み込みと自動再生
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      // 動画が読み込めたら自動再生
      video.play().catch((err) => {
        console.error("動画の自動再生に失敗しました:", err);
        // 自動再生が失敗した場合は、ユーザーに手動再生を促す
        setShowControls(true);
      });
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setShowControls(false);
    };

    const handleEnded = () => {
      // 動画再生完了
      onComplete();
    };

    const handleClick = () => {
      // 動画クリックで一時停止/再生を切り替え
      if (video.paused) {
        video.play();
      } else {
        video.pause();
        setShowControls(true);
      }
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("play", handlePlay);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("click", handleClick);

    // マウス移動でコントロールを表示
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("click", handleClick);
      window.removeEventListener("mousemove", handleMouseMove);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, onComplete]);

  const handleSkip = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    onComplete();
    if (onSkip) {
      onSkip();
    }
  };

  return (
    <div className={`${styles.container} ${isRetroGameMode ? styles.retro : ""}`}>
      <div className={styles.videoWrapper}>
        <video
          ref={videoRef}
          src={videoPath}
          className={styles.video}
          playsInline
          muted={false}
          autoPlay
        />
        
        {/* コントロールオーバーレイ */}
        {showControls && (
          <div className={styles.controls}>
            <button
              onClick={handleSkip}
              className={styles.skipButton}
              aria-label="スキップ"
            >
              {isRetroGameMode ? "SKIP" : "スキップ"}
            </button>
          </div>
        )}

        {/* ローディング表示 */}
        {!isPlaying && (
          <div className={styles.loading}>
            {isRetroGameMode ? "LOADING..." : "読み込み中..."}
          </div>
        )}
      </div>
    </div>
  );
};










