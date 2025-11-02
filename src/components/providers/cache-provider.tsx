'use client';

/**
 * 🧹 Cache Provider - GEÇİCİ OLARAK DEVRE DIŞI
 *
 * SEBEP: Sayfa 3 kere refresh oluyordu
 *
 * Bu component localStorage'ı temizleyip sayfa reload ediyordu
 * Persist middleware kaldırıldıktan sonra gereksiz hale geldi
 */
export function CacheProvider({ children }: { children: React.ReactNode }) {
  // useEffect ile cache kontrolleri GEÇİCİ OLARAK DEVRE DIŞI
  // Persist middleware olmadan cache yönetimine gerek yok

  return <>{children}</>;
}
