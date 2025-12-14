import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

type ModalContextType = {
  isAnyModalOpen: boolean;
  registerModal: (id: string) => () => void;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};

/**
 * モーダルの開閉状態を管理するContext
 * FABなどのグローバルUI要素がモーダルと干渉しないように制御する
 */
export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [openModals, setOpenModals] = useState<Set<string>>(new Set());

  // モーダルを登録し、登録解除用の関数を返す
  const registerModal = useCallback((id: string) => {
    setOpenModals((prev) => new Set([...prev, id]));
    
    // 登録解除用の関数を返す
    return () => {
      setOpenModals((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };
  }, []);

  const isAnyModalOpen = openModals.size > 0;

  // モーダルが開いている時に背景のスクロールを無効化
  useEffect(() => {
    if (isAnyModalOpen) {
      // 現在のスクロール位置を保存
      const scrollY = window.scrollY;
      
      // 現在のスタイルを保存
      const originalBodyOverflow = document.body.style.overflow;
      const originalBodyPosition = document.body.style.position;
      const originalBodyTop = document.body.style.top;
      const originalBodyWidth = document.body.style.width;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      
      // スクロールを無効化（より確実な方法）
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.documentElement.style.overflow = "hidden";
      
      // クリーンアップ: モーダルが閉じた時に元に戻す
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.position = originalBodyPosition;
        document.body.style.top = originalBodyTop;
        document.body.style.width = originalBodyWidth;
        document.documentElement.style.overflow = originalHtmlOverflow;
        // スクロール位置を復元
        window.scrollTo(0, scrollY);
      };
    }
  }, [isAnyModalOpen]);

  return (
    <ModalContext.Provider value={{ isAnyModalOpen, registerModal }}>
      {children}
    </ModalContext.Provider>
  );
};
