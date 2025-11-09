/**
 * useModalConfirmation - Modal kapatma confirmation hook
 *
 * Problem: Kullanıcı 50 döküman seçmiş, yanlışlıkla modal dışına tıklamış → HEPSİ GİTTİ
 * Çözüm: Değişiklik varsa confirmation dialog göster
 *
 * Kullanım:
 * ```typescript
 * const confirmClose = useModalConfirmation(selectedDocuments.length > 0);
 *
 * <div onClick={() => confirmClose(closeModal)}>
 *   // Modal backdrop
 * </div>
 * ```
 */

import { useCallback } from 'react';

export interface ConfirmationOptions {
  /**
   * Confirmation mesajı (custom message)
   */
  message?: string;

  /**
   * Onay butonu metni
   * @default "Evet, Kapat"
   */
  confirmText?: string;

  /**
   * İptal butonu metni
   * @default "Hayır, Devam Et"
   */
  cancelText?: string;

  /**
   * Confirmation'ı tamamen devre dışı bırak (bypass)
   * @default false
   */
  forceClose?: boolean;
}

/**
 * Modal kapatma için confirmation hook
 *
 * @param hasChanges - Kullanıcının kaybedecek değişikliği var mı?
 * @param options - Opsiyonel ayarlar
 * @returns Confirmation'lı close handler
 */
export const useModalConfirmation = (
  hasChanges: boolean,
  options: ConfirmationOptions = {}
) => {
  const {
    message,
    confirmText = 'Evet, Kapat',
    cancelText = 'Hayır, Devam Et',
    forceClose = false,
  } = options;

  /**
   * Modal kapatma handler (confirmation ile)
   * @param callback - Kapatma fonksiyonu (closeModal, setShowModal(false) vs)
   */
  const handleClose = useCallback(
    (callback: () => void) => {
      // Force close varsa veya değişiklik yoksa direkt kapat
      if (forceClose || !hasChanges) {
        callback();
        return;
      }

      // Değişiklik varsa confirmation sor
      const defaultMessage = 'Seçimleriniz kaydedilmedi. Modal kapatılsın mı?';
      const confirmed = window.confirm(message || defaultMessage);

      if (confirmed) {
        callback();
      }
      // Kullanıcı "İptal" derse hiçbir şey yapma (modal açık kalsın)
    },
    [hasChanges, forceClose, message]
  );

  return handleClose;
};

/**
 * Alternatif: Custom confirm dialog ile (daha güzel UI)
 *
 * TODO: Sonraki iterasyonda `window.confirm` yerine custom modal eklenebilir
 * Örnek: Shadcn/ui AlertDialog, Radix Dialog vb.
 */
export const useCustomModalConfirmation = (
  hasChanges: boolean,
  customConfirmDialog?: (message: string) => Promise<boolean>
) => {
  const handleClose = useCallback(
    async (callback: () => void) => {
      if (!hasChanges) {
        callback();
        return;
      }

      if (customConfirmDialog) {
        const confirmed = await customConfirmDialog(
          'Seçimleriniz kaydedilmedi. Devam etmek istiyor musunuz?'
        );
        if (confirmed) callback();
      } else {
        // Fallback: native confirm
        const confirmed = window.confirm('Seçimleriniz kaydedilmedi. Modal kapatılsın mı?');
        if (confirmed) callback();
      }
    },
    [hasChanges, customConfirmDialog]
  );

  return handleClose;
};
