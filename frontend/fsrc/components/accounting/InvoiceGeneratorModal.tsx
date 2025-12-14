import React, { useState, useEffect } from "react";
import { apiClient } from "../../lib/apiClient";
import { DateRangePicker } from "../DateRangePicker";
import { Icon } from "../ui/Icon";
import { useSnackbar } from "../../contexts/SnackbarContext";
import { useModal } from "../../contexts/ModalContext";
import type { InvoiceData, InvoiceResponse } from "../../types/accounting";
import styles from "./InvoiceGeneratorModal.module.css";

type Client = { id: string; name: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export const InvoiceGeneratorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  // モーダル状態の管理（FABの非表示制御のため）
  const { registerModal } = useModal();
  
  useEffect(() => {
    if (isOpen) {
      const unregister = registerModal("invoice-generator-modal");
      return unregister;
    }
  }, [isOpen, registerModal]);

  const [step, setStep] = useState<"select" | "preview">("select");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const { showSnackbar } = useSnackbar();

  // 取引先一覧を取得
  useEffect(() => {
    if (!isOpen) return;
    apiClient
      .get<{ clients: Client[] }>("/api/v1/master/clients")
      .then((res) => setClients(res.clients || []))
      .catch((err) => {
        console.error("Failed to load clients", err);
        showSnackbar("取引先の取得に失敗しました", "error");
      });
  }, [isOpen, showSnackbar]);

  // 初期日付を設定（今月の1日から今日まで）
  useEffect(() => {
    if (!isOpen) return;
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(today.toISOString().split("T")[0]);
  }, [isOpen]);

  const handleGenerate = async () => {
    if (!selectedClient || !startDate || !endDate) {
      showSnackbar("期間と取引先を選択してください", "error");
      return;
    }

    setLoading(true);
    try {
      // URLにクエリパラメータを追加
      const queryParams = new URLSearchParams({
        startDate,
        endDate,
        clientName: selectedClient,
      });
      const path = `/api/v1/accounting/invoice?${queryParams.toString()}`;

      const data = await apiClient.get<InvoiceResponse>(path);
      
      if (data.ok && data.invoice) {
        setInvoiceData(data.invoice);
        setStep("preview");
      } else {
        throw new Error("請求書データの取得に失敗しました");
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.message || "請求書の生成に失敗しました";
      showSnackbar(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // 印刷機能を使用（ブラウザの「PDFに保存」を利用）
    handlePrint();
  };

  const handleBack = () => {
    setStep("select");
    setInvoiceData(null);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  };

  const formatCurrency = (amount: number): string => {
    return `¥ ${amount.toLocaleString()}`;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {step === "select" ? (
          <div className={styles.selectStep}>
            <div className={styles.header}>
              <h2>請求書生成</h2>
              <button className={styles.closeButton} onClick={onClose}>
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className={styles.form}>
              <div className={styles.field}>
                <label>取引先</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className={styles.select}
                >
                  <option value="" disabled>選択してください</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>期間</label>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                />
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.cancelButton}
                  onClick={onClose}
                  disabled={loading}
                >
                  キャンセル
                </button>
                <button
                  className={styles.generateButton}
                  onClick={handleGenerate}
                  disabled={loading || !selectedClient || !startDate || !endDate}
                >
                  {loading ? "生成中..." : "請求書を生成"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.previewStep}>
            <div className={styles.header}>
              <button className={styles.backButton} onClick={handleBack}>
                <Icon name="arrow-left" size={20} />
                戻る
              </button>
              <div className={styles.headerActions}>
                <button className={styles.actionButton} onClick={handleDownloadPDF}>
                  <Icon name="document" size={18} />
                  PDF
                </button>
                <button className={styles.actionButton} onClick={handlePrint}>
                  <Icon name="document" size={18} />
                  印刷
                </button>
                <button className={styles.closeButton} onClick={onClose}>
                  <Icon name="close" size={20} />
                </button>
              </div>
            </div>

            {invoiceData && (
              <div className={styles.invoice}>
                {/* 請求書の内容 */}
                <div className={styles.invoiceHeader}>
                  <h1 className={styles.title}>請求書</h1>
                  <div className={styles.invoiceNumber}>
                    <div className={styles.date}>{formatDate(invoiceData.issueDate)}</div>
                    <div className={styles.number}>請求書番号: {invoiceData.invoiceNumber}</div>
                  </div>
                </div>

                <div className={styles.invoiceBody}>
                  <div className={styles.recipientSection}>
                    <div className={styles.recipientName}>{invoiceData.clientName} 様</div>
                    <div className={styles.recipientText}>下記のとおり請求いたします。</div>
                    {invoiceData.period && (
                      <div className={styles.periodText}>
                        請求期間: {formatDate(invoiceData.period.startDate)} ～ {formatDate(invoiceData.period.endDate)}
                      </div>
                    )}
                  </div>

                  <div className={styles.issuerSection}>
                    <div className={styles.issuerName}>{invoiceData.issuer.companyName}</div>
                    <div className={styles.issuerAddress}>{invoiceData.issuer.address}</div>
                    <div className={styles.issuerReg}>{invoiceData.issuer.registrationNumber}</div>
                  </div>
                </div>

                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th>日付</th>
                      <th>現場名</th>
                      <th>品番・品名</th>
                      <th>数量</th>
                      <th>単価（税抜）</th>
                      <th>金額（税抜）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.date}</td>
                        <td>{item.siteName || "-"}</td>
                        <td>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{formatCurrency(item.unitPrice)}</td>
                        <td>{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                    {/* 空白行を追加（明細が少ない場合のみ、最大5行まで） */}
                    {invoiceData.items.length < 10 && Array.from({ length: Math.max(0, Math.min(5, 10 - invoiceData.items.length)) }).map((_, i) => (
                      <tr key={`empty-${i}`} className={styles.emptyRow}>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className={styles.summary}>
                  <div className={styles.summaryRight}>
                    <div className={styles.summaryRow}>
                      <span>小計（税抜）</span>
                      <span>{formatCurrency(invoiceData.subtotal)}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>消費税</span>
                      <span>{formatCurrency(invoiceData.tax)}</span>
                    </div>
                    <div className={styles.summaryRowTotal}>
                      <span>請求金額（税込）</span>
                      <span>{formatCurrency(invoiceData.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
