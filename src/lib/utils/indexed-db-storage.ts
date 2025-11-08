/**
 * IndexedDB Storage Utility
 * 
 * sessionStorage'ın 5-10MB sınırı yerine sınırsız depolama sağlar.
 * Blob nesnelerini doğrudan saklayabilir (JSON.stringify gerekmez).
 * 
 * Kullanım:
 * - saveToIndexedDB(key, data) → Promise<void>
 * - getFromIndexedDB(key) → Promise<T | null>
 * - deleteFromIndexedDB(key) → Promise<void>
 */

const DB_NAME = 'procheff-ihale-storage';
const STORE_NAME = 'temp-analysis-data';
const DB_VERSION = 1;

/**
 * IndexedDB bağlantısı aç (singleton pattern)
 */
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('❌ IndexedDB açılamadı:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('✅ IndexedDB bağlantısı açıldı');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store oluştur (yoksa)
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log(`📦 ObjectStore oluşturuluyor: ${STORE_NAME}`);
        db.createObjectStore(STORE_NAME);
      }
    };
  });

  return dbPromise;
}

/**
 * IndexedDB'ye veri kaydet
 * 
 * @param key Benzersiz anahtar (örn: "ihale_docs_1234567890")
 * @param data Kaydedilecek veri (Blob dahil herhangi bir nesne)
 * @returns Promise<void>
 */
export async function saveToIndexedDB<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, key);

      // ✅ Transaction tamamlandığında resolve et (request.onsuccess yerine)
      transaction.oncomplete = () => {
        // Veri boyutu hesaplama (Blob'lar için güvenli)
        let sizeInfo = 'unknown size';
        try {
          if (typeof data === 'object' && data !== null) {
            const dataObj = data as any;
            if ('size' in dataObj) {
              sizeInfo = `${(dataObj.size / (1024 * 1024)).toFixed(2)} MB`;
            }
          }
        } catch (e) {
          // Size hesaplama hatası, devam et
        }
        console.log(`✅ IndexedDB transaction complete: ${key} (${sizeInfo})`);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ IndexedDB kayıt hatası:', request.error);
        reject(request.error);
      };

      transaction.onerror = () => {
        console.error('❌ Transaction hatası:', transaction.error);
        reject(transaction.error);
      };
      
      transaction.onabort = () => {
        console.error('❌ Transaction iptal edildi');
        reject(new Error('Transaction aborted'));
      };
    });
  } catch (error) {
    console.error('❌ saveToIndexedDB hatası:', error);
    throw error;
  }
}

/**
 * IndexedDB'den veri getir
 * 
 * @param key Anahtar
 * @returns Promise<T | null> - Veri bulunamazsa null
 */
export async function getFromIndexedDB<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        if (request.result) {
          console.log(`✅ IndexedDB'den yüklendi: ${key}`);
          resolve(request.result);
        } else {
          console.warn(`⚠️ IndexedDB'de bulunamadı: ${key}`);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('❌ IndexedDB okuma hatası:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('❌ getFromIndexedDB hatası:', error);
    return null;
  }
}

/**
 * IndexedDB'den veri sil
 * 
 * @param key Anahtar
 * @returns Promise<void>
 */
export async function deleteFromIndexedDB(key: string): Promise<void> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        console.log(`🗑️ IndexedDB'den silindi: ${key}`);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ IndexedDB silme hatası:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('❌ deleteFromIndexedDB hatası:', error);
    throw error;
  }
}

/**
 * IndexedDB'deki tüm verileri temizle
 */
export async function clearIndexedDB(): Promise<void> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('🧹 IndexedDB temizlendi');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ IndexedDB temizleme hatası:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('❌ clearIndexedDB hatası:', error);
    throw error;
  }
}

/**
 * IndexedDB'deki tüm anahtarları listele (debug için)
 */
export async function listIndexedDBKeys(): Promise<string[]> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const keys = request.result as string[];
        console.log(`📋 IndexedDB anahtarları (${keys.length}):`, keys);
        resolve(keys);
      };

      request.onerror = () => {
        console.error('❌ IndexedDB anahtar listesi hatası:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('❌ listIndexedDBKeys hatası:', error);
    return [];
  }
}
