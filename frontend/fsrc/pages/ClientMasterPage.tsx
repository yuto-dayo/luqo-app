import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { useSnackbar } from "../contexts/SnackbarContext";
import { apiClient } from "../lib/apiClient";
import styles from "./ClientMasterPage.module.css";

type Client = { id: string; name: string };

// 編集モーダル
const EditClientModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSave: (name: string) => Promise<void>;
}> = ({ isOpen, onClose, client, onSave }) => {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.name);
    } else {
      setName("");
    }
  }, [client, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onSave(name.trim());
      onClose();
      setName("");
    } catch (error) {
      // エラーは親コンポーネントで処理
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>
          {client ? "取引先を編集" : "新しい取引先を追加"}
        </h3>
        <div className={styles.modalForm}>
          <label className={styles.modalLabel}>
            取引先名
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 株式会社LUQO工務店"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSave();
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            className={styles.modalInput}
          />
        </div>
        <div className={styles.modalButtonGroup}>
          <button
            onClick={onClose}
            disabled={isSaving}
            className={styles.modalButtonCancel}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className={styles.modalButtonSave}
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ClientMasterPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ clients: Client[] }>("/api/v1/master/clients");
      if (res?.clients) {
        setClients(res.clients);
      }
    } catch (error) {
      showSnackbar("取引先の取得に失敗しました", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (name: string) => {
    if (editingClient) {
      // 更新
      try {
        await apiClient.put<{ ok: boolean; client: Client }>(`/api/v1/master/clients/${editingClient.id}`, {
          name,
        });
        await loadClients();
        showSnackbar("取引先を更新しました", "success");
      } catch (error) {
        showSnackbar("更新に失敗しました", "error");
        throw error;
      }
    } else {
      // 新規追加
      try {
        await apiClient.post<{ ok: boolean; client: Client }>("/api/v1/master/clients", { name });
        await loadClients();
        showSnackbar("取引先を追加しました", "success");
      } catch (error) {
        showSnackbar("追加に失敗しました", "error");
        throw error;
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("削除してよろしいですか？")) return;
    try {
      await apiClient.delete(`/api/v1/master/clients/${id}`);
      await loadClients();
      showSnackbar("削除しました", "info");
    } catch (error) {
      showSnackbar("削除に失敗しました", "error");
    }
  };

  const openAddModal = () => {
    setEditingClient(null);
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  return (
    <>
      <div className={styles.container}>
        {/* ヘッダー */}
        <header className={styles.pageHeader}>
          <button onClick={() => navigate(-1)} className={styles.backButton}>
            <Icon name="arrowLeft" size={24} color="var(--color-text-main)" />
          </button>
          <h2 className={styles.pageTitle}>取引先マスタ</h2>
        </header>

        {/* コンテンツ */}
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loadingState}>
              <p>読み込み中...</p>
            </div>
          ) : clients.length === 0 ? (
            <div className={styles.emptyState}>
              <Icon name="info" size={48} color="var(--color-text-muted)" className={styles.emptyStateIcon} />
              <p className={styles.emptyStateText}>登録されている取引先はありません</p>
              <p className={styles.emptyStateSubtext}>右下のボタンから追加できます</p>
            </div>
          ) : (
            <div className={styles.clientList}>
              {clients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => openEditModal(client)}
                  className={styles.clientItem}
                >
                  <div className={styles.clientItemContent}>
                    <div className={styles.clientAvatar}>
                      {client.name[0]}
                    </div>
                    <div className={styles.clientInfo}>
                      <div className={styles.clientName}>{client.name}</div>
                      <div className={styles.clientHint}>タップして編集</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(client.id);
                    }}
                    className={styles.deleteButton}
                  >
                    <Icon name="trash" size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 新規追加 FAB - Portalでbody直下に配置（app-shell__mainのスタッキングコンテキストの影響を回避） */}
      {typeof document !== "undefined" &&
        createPortal(
          <button onClick={openAddModal} className={styles.fab} aria-label="取引先を追加">
            <Icon name="plus" size={24} color="var(--color-on-seed, white)" />
          </button>,
          document.body
        )}

      {/* 編集モーダル */}
      <EditClientModal
        isOpen={isModalOpen}
        onClose={closeModal}
        client={editingClient}
        onSave={handleSave}
      />
    </>
  );
}
