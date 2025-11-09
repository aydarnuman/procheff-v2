/**
 * BatchToastManager - Toplu işlemler için tek toast yönetimi
 *
 * Problem: 50 döküman indirme = 50 toast notification → UI kirliliği
 * Çözüm: Tek toast, dinamik progress update
 *
 * Kullanım:
 * ```typescript
 * const toastManager = new BatchToastManager();
 * toastManager.start(50, 'Dökümanlar indiriliyor');
 *
 * for (let i = 0; i < 50; i++) {
 *   await downloadDocument(i);
 *   toastManager.update(i + 1, 50, documents[i].name);
 * }
 *
 * toastManager.complete(50, 'Tüm dökümanlar hazır!');
 * ```
 */

import { toast } from 'sonner';

export class BatchToastManager {
  private toastId: string | number | null = null;
  private startTime: number = 0;

  /**
   * Batch işlemini başlat
   * @param total - Toplam işlem sayısı
   * @param action - İşlem açıklaması (örn: "Dökümanlar indiriliyor")
   */
  start(total: number, action: string): void {
    this.startTime = Date.now();
    this.toastId = toast.loading(`${action}: 0/${total}`, {
      duration: Infinity, // Manuel kapatılana kadar açık kalsın
    });
  }

  /**
   * Progress güncelle
   * @param current - Şu ana kadar tamamlanan işlem sayısı
   * @param total - Toplam işlem sayısı
   * @param currentItem - Şu anda işlenen item (opsiyonel)
   */
  update(current: number, total: number, currentItem?: string): void {
    if (!this.toastId) {
      console.warn('BatchToastManager: Toast başlatılmadan update çağrıldı');
      return;
    }

    const percentage = Math.round((current / total) * 100);
    const elapsed = Date.now() - this.startTime;
    const avgTimePerItem = elapsed / current;
    const remainingItems = total - current;
    const estimatedTimeLeft = Math.round((remainingItems * avgTimePerItem) / 1000); // saniye

    let message = `İndiriliyor: ${current}/${total} (${percentage}%)`;

    if (currentItem) {
      // Dosya adını kısalt (max 30 karakter)
      const shortName = currentItem.length > 30
        ? currentItem.substring(0, 27) + '...'
        : currentItem;
      message += `\n📄 ${shortName}`;
    }

    if (estimatedTimeLeft > 0 && current < total) {
      message += `\n⏱️ ${estimatedTimeLeft}s kaldı`;
    }

    toast.loading(message, { id: this.toastId });
  }

  /**
   * Batch işlemi başarıyla tamamlandı
   * @param count - Tamamlanan işlem sayısı
   * @param successMsg - Başarı mesajı
   */
  complete(count: number, successMsg: string): void {
    if (!this.toastId) {
      console.warn('BatchToastManager: Toast başlatılmadan complete çağrıldı');
      return;
    }

    const elapsed = Math.round((Date.now() - this.startTime) / 1000); // saniye
    const message = `✅ ${successMsg}\n${count} dosya • ${elapsed}s`;

    toast.success(message, {
      id: this.toastId,
      duration: 5000, // 5 saniye sonra otomatik kapan
    });

    this.toastId = null;
    this.startTime = 0;
  }

  /**
   * Batch işlemi hata ile sonlandı
   * @param errorMsg - Hata mesajı
   * @param context - Hata bağlamı (opsiyonel)
   */
  error(errorMsg: string, context?: string): void {
    if (!this.toastId) {
      console.warn('BatchToastManager: Toast başlatılmadan error çağrıldı');
      return;
    }

    let message = `❌ ${errorMsg}`;
    if (context) {
      message += `\n${context}`;
    }

    toast.error(message, {
      id: this.toastId,
      duration: 8000, // Hatalar daha uzun gösterilsin
    });

    this.toastId = null;
    this.startTime = 0;
  }

  /**
   * Toast'ı manuel kapat (işlem iptal edildiğinde)
   */
  cancel(): void {
    if (this.toastId) {
      toast.dismiss(this.toastId);
      this.toastId = null;
      this.startTime = 0;
    }
  }

  /**
   * Toast aktif mi?
   */
  isActive(): boolean {
    return this.toastId !== null;
  }
}
