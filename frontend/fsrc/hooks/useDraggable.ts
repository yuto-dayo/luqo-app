import { useState, useRef, useEffect } from "react";

type Position = {
    x: number;
    y: number;
};

type UseDraggableProps = {
    initialPosition?: Position;
    onDragEnd?: () => void;
    onClick?: () => void;
    disabled?: boolean;
    snapMargin?: number; // 画面端への吸着マージン（デフォルト16px）
};

// タップ判定の閾値（ピクセル単位）
// モバイルでの指のブレを考慮して寛容な値に設定
const TAP_THRESHOLD = 15;

// タップ判定の時間制限（ミリ秒）
// この時間以内のタッチで移動距離が小さければ、タップとして優先処理
const TAP_TIME_LIMIT = 400;

export function useDraggable({
    initialPosition,
    onDragEnd,
    onClick,
    disabled = false,
    snapMargin = 16,
}: UseDraggableProps = {}) {
    const [position, setPosition] = useState<Position>(
        initialPosition || { x: window.innerWidth - 84, y: window.innerHeight - 84 }
    );
    const [isDocked, setIsDocked] = useState(false);
    const [dockSide, setDockSide] = useState<"left" | "right" | null>(null); // 吸着している側
    const [isAnimating, setIsAnimating] = useState(false);
    
    // ドラッグ状態の管理
    const isDragging = useRef(false);
    const hasMoved = useRef(false); // 実際に移動したかどうか（タップ判定用）
    const dragStartPos = useRef({ x: 0, y: 0 });
    const dragStartTime = useRef<number>(0); // ドラッグ開始時刻
    const ref = useRef<HTMLButtonElement>(null);

    // FABのサイズを取得（デフォルト56px）
    const fabSize = 56;
    const halfFabSize = fabSize / 2;

    /**
     * 画面端への吸着位置を計算する
     * @param currentX 現在のX座標（FABの左端）
     * @param currentY 現在のY座標
     * @returns 吸着後の座標
     */
    const calculateSnapPosition = (currentX: number, currentY: number): Position => {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // 左右どちらに近いか判定
        // currentXはFABの左端なので、右端は currentX + fabSize
        const distanceToLeft = currentX;
        const distanceToRight = windowWidth - (currentX + fabSize);

        let snappedX = currentX;
        let snappedY = currentY;

        // X座標の吸着判定（左右どちらかに近ければ吸着）
        if (distanceToLeft < snapMargin) {
            // 左端に吸着
            snappedX = -halfFabSize;
            setIsDocked(true);
            setDockSide("left");
        } else if (distanceToRight < snapMargin) {
            // 右端に吸着（FABの左端を右端からhalfFabSize内側に配置）
            snappedX = windowWidth - halfFabSize;
            setIsDocked(true);
            setDockSide("right");
        } else {
            // 吸着しない場合、Y座標のみ考慮（上下端への吸着はしない）
            setIsDocked(false);
            setDockSide(null);
        }

        // Y座標の境界制限（上下端を超えないように）
        snappedY = Math.max(halfFabSize, Math.min(windowHeight - halfFabSize, snappedY));

        return { x: snappedX, y: snappedY };
    };

    /**
     * 座標が画面内かどうかを判定し、必要に応じて補正する
     * pos.x はFABの左端の座標
     */
    const constrainToBounds = (pos: Position): Position => {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const margin = 8; // 最小マージン

        // 左端: 最低でも-leftFabSize（完全に画面外に出ることを許可）
        // 右端: FABの右端（pos.x + fabSize）が画面右端を超えないように
        //       → pos.x <= windowWidth - fabSize - margin
        return {
            x: Math.max(-halfFabSize + margin, Math.min(windowWidth - fabSize - margin, pos.x)),
            y: Math.max(halfFabSize + margin, Math.min(windowHeight - halfFabSize - margin, pos.y)),
        };
    };

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            // リサイズ時に位置を再計算（吸着状態を維持）
            if (isDocked && dockSide) {
                // 吸着状態の場合は端に再配置
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                const newY = Math.max(halfFabSize, Math.min(windowHeight - halfFabSize, position.y));
                const snappedX = dockSide === "left" 
                    ? -halfFabSize 
                    : windowWidth - halfFabSize;
                setPosition({ x: snappedX, y: newY });
            } else {
                // 吸着していない場合は境界内に制限
                const newPosition = constrainToBounds(position);
                setPosition(newPosition);
            }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [position, isDocked, dockSide]);

    // 初期位置が端に近い場合は吸着状態にする
    useEffect(() => {
        const checkInitialDock = () => {
            const windowWidth = window.innerWidth;
            // position.xはFABの左端なので、右端までの距離は windowWidth - (position.x + fabSize)
            const distanceToLeft = position.x;
            const distanceToRight = windowWidth - (position.x + fabSize);
            if (distanceToLeft < snapMargin) {
                setIsDocked(true);
                setDockSide("left");
            } else if (distanceToRight < snapMargin) {
                setIsDocked(true);
                setDockSide("right");
            } else {
                setIsDocked(false);
                setDockSide(null);
            }
        };
        checkInitialDock();
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled) return;

        // すべての状態を最初にリセット（これが最重要）
        isDragging.current = false;
        hasMoved.current = false;
        
        // ドラッグ開始位置と時刻を記録（タップ判定のため）
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        dragStartTime.current = Date.now();

        // 注意: 格納状態からの復帰は handlePointerUp で行う
        // ここで位置を更新すると、タップが誤検出される可能性がある

        const el = ref.current;
        if (!el) return;
        el.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (disabled || !ref.current?.hasPointerCapture(e.pointerId)) return;

        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        const totalDistance = Math.sqrt(dx * dx + dy * dy);

        // ドラッグ判定: 移動距離がTAP_THRESHOLDを超えた場合のみドラッグとして扱う
        // これにより、小さな動きはタップとして維持される
        if (totalDistance > TAP_THRESHOLD) {
            isDragging.current = true;
            hasMoved.current = true;
        }

        // ドラッグフラグが立っている場合のみ位置を更新
        if (isDragging.current) {
            // ドラッグ中は吸着状態を解除し、位置を更新
            if (isDocked) {
                setIsDocked(false);
                setDockSide(null);
                setIsAnimating(true);
                // 格納状態からドラッグ開始時、タッチ位置を基準に位置を設定
                const newX = e.clientX - halfFabSize;
                const newY = Math.max(halfFabSize, Math.min(window.innerHeight - halfFabSize, e.clientY - halfFabSize));
                setPosition({ x: newX, y: newY });
                setTimeout(() => setIsAnimating(false), 300);
            } else {
                const newPos = {
                    x: position.x + e.movementX,
                    y: position.y + e.movementY,
                };
                
                // 画面内に制限
                const constrainedPos = constrainToBounds(newPos);
                setPosition(constrainedPos);
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        const el = ref.current;
        if (el) {
            el.releasePointerCapture(e.pointerId);
        }

        // ドラッグしていた場合のみ、画面端への吸着を実行
        if (hasMoved.current) {
            if (process.env.NODE_ENV === 'development') {
                console.log('[useDraggable] → ドラッグ終了');
            }
            
            // ドラッグ終了時に画面端への吸着を実行
            const snappedPos = calculateSnapPosition(position.x, position.y);
            setIsAnimating(true);
            setPosition(snappedPos);
            
            // アニメーション完了を待つ
            setTimeout(() => setIsAnimating(false), 300);
            
            onDragEnd?.();
        }
        
        // 注意: hasMoved.currentはhandleClickで参照されるため、ここではリセットしない
        // handleClickが呼ばれた後にリセットされる
    };

    /**
     * クリックイベントハンドラ
     * ドラッグ中でなければonClickを呼び出す
     * StarSettingsPage等のFABと同じシンプルな方式
     */
    const handleClick = (e: React.MouseEvent) => {
        if (process.env.NODE_ENV === 'development') {
            console.log('[useDraggable] click:', { hasMoved: hasMoved.current });
        }
        
        // ドラッグしていなければタップとして処理
        if (!hasMoved.current) {
            if (process.env.NODE_ENV === 'development') {
                console.log('[useDraggable] → タップとして処理');
            }
            onClick?.();
        }
        
        // 状態をリセット
        isDragging.current = false;
        hasMoved.current = false;
    };

    // pointercancel イベントのハンドリング
    // タッチがキャンセルされた場合（スクロール開始など）に状態をリセット
    const handlePointerCancel = (e: React.PointerEvent) => {
        const el = ref.current;
        if (el && el.hasPointerCapture(e.pointerId)) {
            el.releasePointerCapture(e.pointerId);
        }
        
        if (process.env.NODE_ENV === 'development') {
            console.log('[useDraggable] pointerCancel: 状態リセット');
        }
        
        // 状態をリセット
        isDragging.current = false;
        hasMoved.current = false;
    };

    /**
     * 格納状態を解除して内側に移動する関数
     */
    const undock = () => {
        if (!isDocked || !dockSide) return;
        
        setIsDocked(false);
        setIsAnimating(true);
        
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const moveDistance = 80; // 内側に移動する距離
        
        // 現在のY座標を維持しつつ、X座標のみ内側に移動
        let newX: number;
        if (dockSide === "right") {
            // 右端から内側に移動
            newX = windowWidth - halfFabSize - moveDistance;
        } else {
            // 左端から内側に移動
            newX = -halfFabSize + moveDistance;
        }
        
        // Y座標は現在の位置を維持（画面内に制限）
        const newY = Math.max(halfFabSize, Math.min(windowHeight - halfFabSize, position.y));
        
        setPosition({ x: newX, y: newY });
        setDockSide(null);
        
        // アニメーション完了を待つ
        setTimeout(() => setIsAnimating(false), 300);
    };

    return {
        position,
        isDocked,
        dockSide,
        isAnimating,
        ref,
        undock,
        handlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerCancel: handlePointerCancel,
            onClick: handleClick,
        },
    };
}
