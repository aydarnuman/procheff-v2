/**
 * UNIFIED FILE UPLOAD COMPONENT
 * 
 * Modern drag-drop file upload with:
 * - Visual feedback
 * - Progress tracking
 * - File validation
 * - Multiple file support
 * - AI analiz trigger butonu
 */

"use client";

import React, { useCallback, useRef } from "react";
import { useFileUploadStore, selectFileStats } from "@/lib/stores/file-upload-store";
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface UnifiedFileUploadProps {
  maxFiles?: number;
  maxSizeMB?: number;
  acceptedTypes?: string[];
  showAnalysisButton?: boolean; // AI Analiz butonu göster
}

export function UnifiedFileUpload({
  maxFiles = 10,
  maxSizeMB = 50,
  acceptedTypes = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".txt", ".zip", ".rar"],
  showAnalysisButton = true,
}: UnifiedFileUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    files,
    isDragging,
    isUploading,
    isReadyForAnalysis,
    addFiles,
    removeFile,
    clearFiles,
    setIsDragging,
    prepareAnalysisPayload,
  } = useFileUploadStore();
  
  const stats = useFileUploadStore(selectFileStats);

  // ========================================
  // FILE VALIDATION
  // ========================================
  
  const validateFile = (file: File): string | null => {
    // Size check
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return `Dosya çok büyük (max ${maxSizeMB}MB)`;
    }
    
    // Type check
    const fileExt = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (acceptedTypes.length > 0 && !acceptedTypes.includes(fileExt)) {
      return `Desteklenmeyen format (izin verilenler: ${acceptedTypes.join(", ")})`;
    }
    
    return null; // Valid
  };

  // ========================================
  // FILE HANDLERS
  // ========================================
  
  const handleFilesSelected = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles || selectedFiles.length === 0) return;
      
      const fileArray = Array.from(selectedFiles);
      
      // Max file count check
      if (files.length + fileArray.length > maxFiles) {
        toast.error(`En fazla ${maxFiles} dosya yükleyebilirsiniz`);
        return;
      }
      
      // Validate each file
      const validFiles: File[] = [];
      const errors: string[] = [];
      
      fileArray.forEach(file => {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          validFiles.push(file);
        }
      });
      
      // Show errors
      if (errors.length > 0) {
        toast.error(
          <div>
            <p className="font-semibold">Bazı dosyalar geçersiz:</p>
            <ul className="text-xs mt-1 space-y-0.5">
              {errors.slice(0, 3).map((err, idx) => (
                <li key={idx}>• {err}</li>
              ))}
              {errors.length > 3 && <li>• ... ve {errors.length - 3} daha</li>}
            </ul>
          </div>,
          { duration: 5000 }
        );
      }
      
      // Add valid files
      if (validFiles.length > 0) {
        addFiles(validFiles);
        toast.success(`${validFiles.length} dosya eklendi`);
      }
    },
    [files.length, maxFiles, addFiles]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset input
    }
  };

  // ========================================
  // DRAG & DROP
  // ========================================
  
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    handleFilesSelected(e.dataTransfer.files);
  };

  // ========================================
  // ANALYSIS TRIGGER
  // ========================================
  
  const handleStartAnalysis = async () => {
    const payload = prepareAnalysisPayload();
    
    if (!payload) {
      toast.error("Dosyalar henüz hazır değil");
      return;
    }
    
    try {
      toast.loading("Analize yönlendiriliyor...", { id: "analysis-redirect" });
      
      // Store payload in sessionStorage (temporary)
      const sessionKey = `analysis_payload_${payload.timestamp}`;
      sessionStorage.setItem(sessionKey, JSON.stringify(payload));
      
      // Navigate to analysis page
      router.push(`/ihale/yeni-analiz?session=${sessionKey}`);
      
      toast.success("Analiz sayfasına yönlendiriliyorsunuz", { id: "analysis-redirect" });
    } catch (error) {
      console.error("[UnifiedFileUpload] Analysis redirect error:", error);
      toast.error("Yönlendirme hatası", { id: "analysis-redirect" });
    }
  };

  // ========================================
  // RENDER
  // ========================================
  
  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-8 transition-all duration-200
          ${
            isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          }
          ${isUploading ? "opacity-50 pointer-events-none" : ""}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          onChange={handleFileInputChange}
          className="hidden"
          id="file-upload-input"
        />
        
        <label
          htmlFor="file-upload-input"
          className="flex flex-col items-center gap-4 cursor-pointer"
        >
          <div className={`
            p-4 rounded-full transition-colors
            ${isDragging ? "bg-blue-100 dark:bg-blue-800" : "bg-gray-100 dark:bg-gray-800"}
          `}>
            <Upload className={`w-8 h-8 ${isDragging ? "text-blue-600" : "text-gray-600"}`} />
          </div>
          
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {isDragging ? "Dosyaları bırakın" : "Dosya yüklemek için tıklayın veya sürükleyin"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Desteklenen formatlar: {acceptedTypes.join(", ")}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Maksimum {maxFiles} dosya, dosya başına max {maxSizeMB}MB
            </p>
          </div>
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">
              Yüklenen Dosyalar ({stats.total})
            </h3>
            <button
              onClick={clearFiles}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Tümünü Temizle
            </button>
          </div>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {files.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {file.status === "completed" && <CheckCircle className="w-5 h-5 text-green-600" />}
                  {file.status === "error" && <AlertCircle className="w-5 h-5 text-red-600" />}
                  {file.status === "uploading" && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
                  {file.status === "pending" && <FileText className="w-5 h-5 text-gray-400" />}
                </div>
                
                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {file.metadata.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{(file.metadata.size / 1024).toFixed(1)} KB</span>
                    {file.wordCount && <span>• {file.wordCount.toLocaleString()} kelime</span>}
                    {file.status === "error" && file.error && (
                      <span className="text-red-600">• {file.error}</span>
                    )}
                  </div>
                  
                  {/* Progress Bar */}
                  {file.status === "uploading" && (
                    <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                      <div
                        className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                
                {/* Remove Button */}
                <button
                  onClick={() => removeFile(file.id)}
                  className="flex-shrink-0 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Dosyayı kaldır"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Button */}
      {showAnalysisButton && isReadyForAnalysis && (
        <button
          onClick={handleStartAnalysis}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Sparkles className="w-5 h-5" />
          AI Analiz Başlat ({stats.completed} dosya hazır)
        </button>
      )}
      
      {/* Stats Badge */}
      {stats.total > 0 && (
        <div className="flex items-center justify-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm">
          <span className="text-green-600 dark:text-green-400">
            ✓ {stats.completed} tamamlandı
          </span>
          {stats.failed > 0 && (
            <span className="text-red-600 dark:text-red-400">
              ✗ {stats.failed} başarısız
            </span>
          )}
          {stats.pending > 0 && (
            <span className="text-gray-600 dark:text-gray-400">
              ⏳ {stats.pending} bekliyor
            </span>
          )}
        </div>
      )}
    </div>
  );
}
