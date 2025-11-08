/**
 * Custom Hook for File State Management with Session Storage
 *
 * Handles file persistence across Fast Refresh in development mode
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  saveFilesToSession,
  loadFilesFromSession,
  saveFileQueueToSession,
  loadFileQueueFromSession,
  clearFileSessionStorage,
  isDevelopment,
  getFastRefreshWarning
} from '@/lib/utils/file-session-storage';

interface UseFileStateReturn {
  fileObjectsMap: Map<string, File>;
  fileQueue: string[];
  currentlyProcessing: string | null;
  addFile: (file: File) => void;
  removeFile: (fileName: string) => void;
  clearFiles: () => void;
  setFileQueue: (queue: string[]) => void;
  setCurrentlyProcessing: (fileName: string | null) => void;
  getFile: (fileName: string) => File | undefined;
  hasFile: (fileName: string) => boolean;
  getAllFileNames: () => string[];
}

/**
 * File state management hook with session storage persistence
 */
export const useFileState = (): UseFileStateReturn => {
  // Local state - Fast Refresh'te resetlenir ama sessionStorage'dan geri yüklenir
  const [fileQueue, setFileQueueState] = useState<string[]>([]);
  const [currentlyProcessing, setCurrentlyProcessingState] = useState<string | null>(null);

  // useRef - Fast Refresh'te korunur
  const fileObjectsMapRef = useRef<Map<string, File>>(new Map());
  const isInitializedRef = useRef<boolean>(false);

  // Session storage'dan state'i geri yükle (sadece bir kez)
  useEffect(() => {
    if (isInitializedRef.current) return;

    try {
      // Session storage'dan dosyaları yükle
      const loadedFiles = loadFilesFromSession();
      const loadedQueue = loadFileQueueFromSession();

      fileObjectsMapRef.current = loadedFiles;
      setFileQueueState(loadedQueue);

      if (loadedFiles.size > 0) {
        console.log(`📦 ${loadedFiles.size} dosya session storage'dan geri yüklendi`);
      }

      if (isDevelopment()) {
        console.info(getFastRefreshWarning());
      }

      isInitializedRef.current = true;
    } catch (error) {
      console.error('❌ File state initialization failed:', error);
    }
  }, []);

  // State değişikliklerini session storage'a kaydet
  useEffect(() => {
    if (!isInitializedRef.current) return;

    try {
      saveFilesToSession(fileObjectsMapRef.current);
    } catch (error) {
      console.warn('❌ File storage sync failed:', error);
    }
  }, [fileQueue, currentlyProcessing]); // Bu effect fileQueue veya currentlyProcessing değiştiğinde çalışacak

  // File ekleme
  const addFile = useCallback((file: File) => {
    const fileName = file.name;

    // Zaten varsa güncelle
    if (fileObjectsMapRef.current.has(fileName)) {
      console.warn(`⚠️ ${fileName} zaten mevcut, güncelleniyor...`);
    }

    fileObjectsMapRef.current.set(fileName, file);

    // Queue'ya ekle (eğer yoksa)
    setFileQueueState(prev => {
      if (!prev.includes(fileName)) {
        const newQueue = [...prev, fileName];
        saveFileQueueToSession(newQueue);
        return newQueue;
      }
      return prev;
    });

    console.log(`✅ ${fileName} eklendi (${(file.size / 1024).toFixed(2)} KB)`);
  }, []);

  // File silme
  const removeFile = useCallback((fileName: string) => {
    fileObjectsMapRef.current.delete(fileName);

    setFileQueueState(prev => {
      const newQueue = prev.filter(name => name !== fileName);
      saveFileQueueToSession(newQueue);
      return newQueue;
    });

    console.log(`🗑️ ${fileName} silindi`);
  }, []);

  // Tüm dosyaları temizle
  const clearFiles = useCallback(() => {
    fileObjectsMapRef.current.clear();
    setFileQueueState([]);
    setCurrentlyProcessingState(null);
    clearFileSessionStorage();
    console.log('🧹 Tüm dosyalar temizlendi');
  }, []);

  // File queue güncelleme
  const setFileQueue = useCallback((queue: string[]) => {
    setFileQueueState(queue);
    saveFileQueueToSession(queue);
  }, []);

  // Currently processing güncelleme
  const setCurrentlyProcessing = useCallback((fileName: string | null) => {
    setCurrentlyProcessingState(fileName);
  }, []);

  // Yardımcı fonksiyonlar
  const getFile = useCallback((fileName: string): File | undefined => {
    return fileObjectsMapRef.current.get(fileName);
  }, []);

  const hasFile = useCallback((fileName: string): boolean => {
    return fileObjectsMapRef.current.has(fileName);
  }, []);

  const getAllFileNames = useCallback((): string[] => {
    return Array.from(fileObjectsMapRef.current.keys());
  }, []);

  return {
    fileObjectsMap: fileObjectsMapRef.current,
    fileQueue,
    currentlyProcessing,
    addFile,
    removeFile,
    clearFiles,
    setFileQueue,
    setCurrentlyProcessing,
    getFile,
    hasFile,
    getAllFileNames
  };
};