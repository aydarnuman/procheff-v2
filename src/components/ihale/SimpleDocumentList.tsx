'use client';

import React from 'react';
import { FileProcessingStatus, CSVFileStatus } from '@/lib/stores/ihale-store';
import { BelgeTuru, BELGE_TURU_LABELS } from '@/types/ai';
import { FileText, Trash2, CheckCircle, AlertCircle, Loader2, Upload, FileImage, FileCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SimpleDocumentListProps {
  fileStatuses: FileProcessingStatus[];
  csvFiles?: CSVFileStatus[];
  onFileSelect: (files: File[]) => void;
  onFileRemove: (fileName: string) => void;
  onFileProcess: (fileName: string) => Promise<void>;
  onCSVSelect?: (files: File[]) => void;
  onCSVRemove?: (fileName: string) => void;
  onCSVProcess?: (fileName: string) => Promise<void>;
}

export function SimpleDocumentList({
  fileStatuses,
  csvFiles = [],
  onFileSelect,
  onFileRemove,
  onFileProcess,
  onCSVSelect,
  onCSVRemove,
  onCSVProcess
}: SimpleDocumentListProps) {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onFileSelect(files);
    }
    event.target.value = '';
  };

  const handleCSVInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0 && onCSVSelect) {
      onCSVSelect(files);
    }
    event.target.value = '';
  };

  // Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileSelect(files);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 border-green-500/50 text-green-400';
      case 'processing': return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
      case 'error': return 'bg-red-500/20 border-red-500/50 text-red-400';
      default: return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'processing': return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-400" />;
      default: return <FileText className="w-5 h-5 text-yellow-400" />;
    }
  };

  // Dosya tipi ikonlarını döndür
  const getFileTypeIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf':
        return <FileText className="w-6 h-6 text-red-400" />;
      case 'doc':
      case 'docx':
        return <FileCode className="w-6 h-6 text-blue-400" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <FileImage className="w-6 h-6 text-purple-400" />;
      case 'csv':
        return <FileText className="w-6 h-6 text-green-400" />;
      default:
        return <FileText className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusText = (file: FileProcessingStatus) => {
    switch (file.status) {
      case 'completed':
        return `✓ ${file.wordCount?.toLocaleString() || 0} kelime`;
      case 'processing':
        return file.progress || 'İşleniyor...';
      case 'error':
        return file.error || 'Hata';
      default:
        return 'İşlenmeyi bekliyor';
    }
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* Stage Indicator - Dark & Noble */}
      <div className="flex items-center gap-6 bg-black/40 border-y border-slate-800 py-5 px-8 backdrop-blur-md">
        {/* İlk Aşama Badge */}
        <div className="relative group">
          {/* Subtle Glow */}
          <div className="absolute -inset-1 bg-slate-700/30 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          {/* Badge Content */}
          <div className="relative px-6 py-3 bg-slate-900 border border-slate-700 rounded-xl shadow-xl">
            <div className="flex items-center gap-3">
              {/* Number Circle */}
              <div className="flex items-center justify-center w-10 h-10 bg-slate-800 border border-slate-600 rounded-full">
                <span className="text-slate-300 font-bold text-base">1</span>
              </div>
              
              {/* Text */}
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">AŞAMA</span>
                <span className="text-base font-semibold text-slate-200">Dosya İşleme</span>
              </div>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="h-10 w-px bg-slate-700"></div>
        
        {/* Title with Icon */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg">
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-200">OCR & Metin Çıkarma</h3>
        </div>
        
        <div className="flex-1"></div>
        
        {/* Enhanced Stats with Colors */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg">
            <span className="text-xs text-gray-400">Toplam:</span>
            <span className="text-sm font-semibold text-white">{fileStatuses.length}</span>
          </div>
          {fileStatuses.filter(f => f.status === 'completed').length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
              <span className="text-xs text-green-400">✓ İşlendi:</span>
              <span className="text-sm font-semibold text-green-300">
                {fileStatuses.filter(f => f.status === 'completed').length}
              </span>
            </div>
          )}
          {fileStatuses.filter(f => f.status === 'processing').length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg animate-pulse">
              <span className="text-xs text-blue-400">⏳ İşleniyor:</span>
              <span className="text-sm font-semibold text-blue-300">
                {fileStatuses.filter(f => f.status === 'processing').length}
              </span>
            </div>
          )}
          {csvFiles.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <span className="text-xs text-emerald-400">📊 CSV:</span>
              <span className="text-sm font-semibold text-emerald-300">{csvFiles.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Upload Section - Dark Noble Card */}
      <div className="relative mx-8">
        {/* Main Card */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-10 shadow-2xl shadow-black/50">
          {/* Upload Buttons */}
          <div className="flex items-center justify-end gap-4 mb-8">
            <label className="cursor-pointer group/btn" htmlFor="document-file-input">
              <input
                id="document-file-input"
                name="document-files"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={handleFileInput}
                className="hidden"
                aria-label="PDF, Word veya resim dosyası yükle"
              />
              <div className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 rounded-lg transition-all duration-200 flex items-center gap-3 font-medium shadow-lg hover:shadow-xl">
                <Upload className="w-5 h-5" />
                <span>Belge Ekle</span>
              </div>
            </label>

            {onCSVSelect && (
              <label className="cursor-pointer" htmlFor="csv-file-input">
                <input
                  id="csv-file-input"
                  name="csv-files"
                  type="file"
                  multiple
                  accept=".csv"
                  onChange={handleCSVInput}
                  className="hidden"
                  aria-label="CSV maliyet dosyası yükle"
                />
                <div className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 rounded-lg transition-all duration-200 flex items-center gap-3 font-medium shadow-lg hover:shadow-xl">
                  <span className="text-lg">📊</span>
                  <span>CSV Ekle</span>
                </div>
              </label>
            )}
          </div>

          {/* File List */}
          <div className="space-y-3">
          {fileStatuses.length === 0 ? (
            <div 
              className={`
                text-center py-20 px-6 rounded-xl border-2 border-dashed transition-all duration-300
                ${isDragging 
                  ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' 
                  : 'border-slate-600 hover:border-blue-500/50 hover:bg-slate-800/30'
                }
              `}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <motion.div
                initial={{ scale: 1 }}
                animate={{ scale: isDragging ? 1.1 : 1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="relative inline-block mb-6">
                  <div className={`absolute inset-0 blur-2xl rounded-full transition-all ${isDragging ? 'bg-blue-500/40' : 'bg-blue-500/20'}`}></div>
                  <FileText className={`relative w-20 h-20 mx-auto transition-colors ${isDragging ? 'text-blue-400' : 'text-blue-400/60'}`} />
                </div>
              </motion.div>
              
              <h3 className="text-xl font-semibold text-white mb-2">
                {isDragging ? '📂 Dosyaları buraya bırakın' : 'Henüz dosya eklenmedi'}
              </h3>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                {isDragging 
                  ? 'Dosyaları serbest bırakarak yüklemeyi başlatın'
                  : 'Dosyaları sürükleyip bırakın veya yüklemek için butona tıklayın'
                }
              </p>

              {/* Dosya Tipi Örnekleri */}
              <div className="flex items-center justify-center gap-6 mb-8">
                <div className="flex flex-col items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <FileText className="w-8 h-8 text-red-400" />
                  <span className="text-xs text-gray-400">PDF</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <FileCode className="w-8 h-8 text-blue-400" />
                  <span className="text-xs text-gray-400">Word</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <FileImage className="w-8 h-8 text-purple-400" />
                  <span className="text-xs text-gray-400">Resim</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>Maksimum 50MB</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Çoklu dosya desteği</span>
                </div>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {fileStatuses.map((file, index) => (
                <motion.div
                  key={file.fileMetadata.name}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -100, scale: 0.9 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`
                    group relative flex items-center gap-4 p-5 rounded-xl border-2 
                    transition-all duration-300 cursor-default
                    hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20
                    ${file.status === 'processing' 
                      ? 'bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-transparent animate-gradient-x' 
                      : getStatusColor(file.status)
                    }
                  `}
                  style={file.status === 'processing' ? {
                    backgroundImage: 'linear-gradient(45deg, rgba(59, 130, 246, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
                    borderImage: 'linear-gradient(45deg, rgba(59, 130, 246, 0.5), rgba(168, 85, 247, 0.5)) 1',
                  } : undefined}
                >
                  {/* Dosya Tipi İkonu */}
                  <div className="flex-shrink-0 transform group-hover:scale-110 transition-transform">
                    {getFileTypeIcon(file.fileMetadata.name)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-white truncate">
                        {file.fileMetadata.name}
                      </h4>
                      
                      {/* Status Badge (Modern Pill Tasarım) */}
                      <div className={`
                        flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                        ${file.status === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                          file.status === 'processing' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse' :
                          file.status === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                          'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                        }
                      `}>
                        {getStatusIcon(file.status)}
                        <span>{getStatusText(file)}</span>
                      </div>
                      
                      {file.detectedType && (
                        <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-medium border border-purple-500/30 flex-shrink-0">
                          {BELGE_TURU_LABELS[file.detectedType as BelgeTuru]}
                        </span>
                      )}
                    </div>
                    
                    {/* Dosya Bilgileri + Word Count Badge */}
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full"></span>
                        {(file.fileMetadata.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      
                      {/* Word Count Badge (sadece tamamlanan dosyalar için) */}
                      {file.status === 'completed' && file.wordCount && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-medium border border-emerald-500/30">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {file.wordCount.toLocaleString('tr-TR')} kelime
                        </span>
                      )}
                    </div>

                    {/* Progress Bar for Processing */}
                    {file.status === 'processing' && (
                      <div className="mt-3 space-y-1">
                        <div className="h-2 bg-slate-900/50 rounded-full overflow-hidden relative">
                          {/* Animasyonlu gradient progress bar */}
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 relative overflow-hidden"
                            style={{ width: `${file.progressPercentage || 0}%` }}
                          >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                          </div>
                        </div>
                        {file.progress && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-blue-300 font-medium">{file.progress}</span>
                            <span className="text-gray-400 font-mono tabular-nums">{file.progressPercentage || 0}%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {file.status === 'pending' && (
                    <button
                      onClick={() => onFileProcess(file.fileMetadata.name)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                      aria-label={`${file.fileMetadata.name} dosyasını işle`}
                    >
                      İşle
                    </button>
                  )}
                  {file.status !== 'processing' && (
                    <button
                      onClick={() => onFileRemove(file.fileMetadata.name)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Sil"
                      aria-label={`${file.fileMetadata.name} dosyasını sil`}
                    >
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          )}

          {/* CSV Files */}
          {csvFiles.map((csv, index) => (
            <div
              key={csv.fileMetadata.name}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${getStatusColor(csv.status)}`}
            >
              {/* Status Icon */}
              <div className="flex-shrink-0">
                {getStatusIcon(csv.status)}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h4 className="font-medium text-white truncate">
                    {csv.fileMetadata.name}
                  </h4>
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-xs font-medium flex-shrink-0">
                    📊 CSV
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm">
                  <span className="text-gray-400">
                    {(csv.fileMetadata.size / 1024).toFixed(2)} KB
                  </span>
                  {csv.status === 'completed' && csv.analysis && (
                    <span className="text-green-400">
                      ✓ {csv.analysis.summary.total_items} ürün • {csv.analysis.summary.total_cost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                    </span>
                  )}
                  {csv.status === 'processing' && (
                    <span className="text-blue-400">İşleniyor...</span>
                  )}
                  {csv.status === 'error' && (
                    <span className="text-red-400">{csv.error || 'Hata'}</span>
                  )}
                  {csv.status === 'pending' && (
                    <span className="text-yellow-400">İşlenmeyi bekliyor</span>
                  )}
                </div>
                {/* AI Provider Bilgisi */}
                <div className="flex items-center gap-1.5 text-xs mt-2">
                  <span className="text-gray-500">🧠</span>
                  <span className="text-blue-400 font-medium">Claude Sonnet 4</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-400">Tablo analizi</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {csv.status === 'pending' && onCSVProcess && (
                  <button
                    onClick={() => onCSVProcess(csv.fileMetadata.name)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium"
                    aria-label={`${csv.fileMetadata.name} CSV dosyasını işle`}
                  >
                    İşle
                  </button>
                )}
                {csv.status !== 'processing' && onCSVRemove && (
                  <button
                    onClick={() => onCSVRemove(csv.fileMetadata.name)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Sil"
                    aria-label={`${csv.fileMetadata.name} CSV dosyasını sil`}
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* Summary - Premium Stats Cards */}
      {(fileStatuses.length > 0 || csvFiles.length > 0) && (
        <div className="grid grid-cols-4 gap-4 mx-8">
          {/* Toplam Dosya */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-800 rounded">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-200">
                {fileStatuses.length + csvFiles.length}
              </div>
            </div>
            <div className="text-sm text-slate-500 font-medium">Toplam Dosya</div>
          </div>

          {/* Bekliyor */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-yellow-900/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-950/50 rounded">
                <span className="text-xl">⏸</span>
              </div>
              <div className="text-2xl font-bold text-yellow-600">
                {fileStatuses.filter(f => f.status === 'pending').length + csvFiles.filter(c => c.status === 'pending').length}
              </div>
            </div>
            <div className="text-sm text-slate-500 font-medium">Bekliyor</div>
          </div>

          {/* İşleniyor */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-blue-900/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-950/50 rounded">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {fileStatuses.filter(f => f.status === 'processing').length + csvFiles.filter(c => c.status === 'processing').length}
              </div>
            </div>
            <div className="text-sm text-slate-500 font-medium">İşleniyor</div>
          </div>

          {/* Tamamlandı */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-green-900/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-950/50 rounded">
                <CheckCircle className="w-5 h-5 text-green-700" />
              </div>
              <div className="text-2xl font-bold text-green-700">
                {fileStatuses.filter(f => f.status === 'completed').length + csvFiles.filter(c => c.status === 'completed').length}
              </div>
            </div>
            <div className="text-sm text-slate-500 font-medium">Tamamlandı</div>
          </div>
        </div>
      )}
    </div>
  );
}
