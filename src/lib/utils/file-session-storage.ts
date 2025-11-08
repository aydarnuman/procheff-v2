/**
 * File State Management for Fast Refresh Compatibility
 *
 * Problem: Next.js 16 Fast Refresh resets Zustand store and useRef
 * Solution: Use sessionStorage to persist file objects across Fast Refresh
 */

interface StoredFileData {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  blob: string; // Base64 encoded blob
}

const FILE_STORAGE_KEY = 'ihale_files_v2';
const FILE_QUEUE_KEY = 'ihale_file_queue_v2';

/**
 * File objelerini sessionStorage'a kaydet
 */
export const saveFilesToSession = (fileMap: Map<string, File>): void => {
  try {
    const filesData: StoredFileData[] = [];

    for (const [name, file] of fileMap) {
      // File'ı blob'a çevir ve base64'e encode et
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        filesData.push({
          name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          blob: base64
        });

        // Tüm dosyalar işlendikten sonra kaydet
        if (filesData.length === fileMap.size) {
          sessionStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(filesData));
        }
      };
      reader.readAsDataURL(file);
    }
  } catch (error) {
    console.warn('❌ File storage failed:', error);
  }
};

/**
 * File objelerini sessionStorage'dan geri yükle
 */
export const loadFilesFromSession = (): Map<string, File> => {
  try {
    const stored = sessionStorage.getItem(FILE_STORAGE_KEY);
    if (!stored) return new Map();

    const filesData: StoredFileData[] = JSON.parse(stored);
    const fileMap = new Map<string, File>();

    for (const data of filesData) {
      // Base64'i blob'a çevir
      const byteString = atob(data.blob.split(',')[1]);
      const mimeString = data.blob.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);

      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }

      const blob = new Blob([ab], { type: mimeString });
      const file = new File([blob], data.name, {
        type: data.type,
        lastModified: data.lastModified
      });

      fileMap.set(data.name, file);
    }

    return fileMap;
  } catch (error) {
    console.warn('❌ File loading failed:', error);
    return new Map();
  }
};

/**
 * File queue'yu sessionStorage'a kaydet
 */
export const saveFileQueueToSession = (queue: string[]): void => {
  try {
    sessionStorage.setItem(FILE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn('❌ Queue storage failed:', error);
  }
};

/**
 * File queue'yu sessionStorage'dan yükle
 */
export const loadFileQueueFromSession = (): string[] => {
  try {
    const stored = sessionStorage.getItem(FILE_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('❌ Queue loading failed:', error);
    return [];
  }
};

/**
 * Tüm file state'ini temizle (sayfa değiştiğinde)
 */
export const clearFileSessionStorage = (): void => {
  try {
    sessionStorage.removeItem(FILE_STORAGE_KEY);
    sessionStorage.removeItem(FILE_QUEUE_KEY);
  } catch (error) {
    console.warn('❌ Clear storage failed:', error);
  }
};

/**
 * Development mode kontrolü
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

/**
 * Fast Refresh uyarı mesajı
 */
export const getFastRefreshWarning = (): string => {
  return '⚠️ Development modunda Fast Refresh aktif. Kod değişikliğinde dosyalar yeniden yüklenmeyebilir.';
};