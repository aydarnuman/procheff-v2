'use client';

import React from 'react';
import { FileProcessingStatus, CSVFileStatus } from '@/lib/stores/ihale-store';
import { BelgeTuru, BELGE_TURU_LABELS } from '@/types/ai';
import { FileText, Trash2, CheckCircle, AlertCircle, Loader2, Upload, FileImage, FileCode, Eye, X } from 'lucide-react';
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
  readOnly?: boolean; // 🆕 Yeni prop - sadece görüntüleme modu için
  onStartAnalysis?: () => void; // 🚀 AI Analiz başlatma butonu için
}

export function SimpleDocumentList({
  fileStatuses,
  csvFiles = [],
  onFileSelect,
  onFileRemove,
  onFileProcess,
  onCSVSelect,
  onCSVRemove,
  onCSVProcess,
  readOnly = false, // 🆕 Default false - upload adımında düzenlenebilir
  onStartAnalysis // 🚀 AI Analiz başlatma butonu için
}: SimpleDocumentListProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [previewModal, setPreviewModal] = React.useState<{ fileName: string; content: string } | null>(null);

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onFileSelect(files);
    }
    event.target.value = '';
  };

  const handleCSVInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const files = Array.from(event.target.files || []);
    if (files.length > 0 && onCSVSelect) {
      onCSVSelect(files);
    }
    event.target.value = '';
  };

  // Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
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

  // 🆕 Dosya formatını otomatik algıla
  const getFileFormat = (fileName: string): string => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    const formatMap: Record<string, string> = {
      'pdf': '📄 PDF',
      'doc': '📝 DOC',
      'docx': '📝 DOCX',
      'txt': '📃 TXT',
      'rtf': '📃 RTF',
      'html': '🌐 HTML',
      'json': '🔧 JSON',
      'csv': '📊 CSV',
      'jpg': '🖼️ JPG',
      'jpeg': '🖼️ JPEG',
      'png': '🖼️ PNG',
      'gif': '🖼️ GIF',
    };
    return formatMap[ext] || `❓ ${ext.toUpperCase()}`;
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
    <div className="w-full mx-auto space-y-4">
      {/* Stage Indicator - Compact Dark Design */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800"></div>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(148, 163, 184, 0.15) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}></div>
        
        <div className="relative flex items-center gap-6 py-4 px-6">
          {/* Vertical Accent */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-slate-600 to-transparent"></div>
          
          {/* Stage Badge - Compact */}
          <div className="relative">
            <div className="absolute -inset-2 bg-slate-600/20 blur-lg"></div>
            <div className="relative flex items-center gap-3 px-4 py-2 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg">
              {/* Number Circle */}
              <div className="relative">
                <div className="absolute inset-0 bg-slate-600/30 rounded-full blur animate-pulse"></div>
                <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full border-2 border-slate-600">
                  <span className="text-slate-200 font-black text-lg">1</span>
                </div>
              </div>
              
              {/* Text */}
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 uppercase tracking-wide">AŞAMA</span>
                <span className="text-base font-bold text-white">Dosya İşleme</span>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="h-12 w-px bg-gradient-to-b from-transparent via-slate-600 to-transparent"></div>
          
          {/* Title */}
          <div className="flex items-center gap-3 flex-1">
            <div className="relative">
              <div className="absolute inset-0 bg-slate-600/20 rounded-lg blur-lg"></div>
              <div className="relative p-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-black text-white">OCR & Metin Çıkarma</h3>
              <p className="text-xs text-slate-500">Belgeleri metne dönüştür • Analiz hazırlığı</p>
            </div>
          </div>
          
          {/* Stats - Inline */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 border border-slate-700 rounded">
              <span className="text-xs text-slate-500">Toplam:</span>
              <span className="text-sm font-bold text-white">{fileStatuses.length}</span>
            </div>
            {fileStatuses.some(f => f.status === 'pending') && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-950/30 border border-yellow-900/50 rounded">
                <span className="text-xs text-yellow-600">Bekleyen:</span>
                <span className="text-sm font-bold text-yellow-500">
                  {fileStatuses.filter(f => f.status === 'pending').length}
                </span>
              </div>
            )}
            {fileStatuses.some(f => f.status === 'processing') && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-950/30 border border-blue-900/50 rounded">
                <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                <span className="text-sm font-bold text-blue-500">
                  {fileStatuses.filter(f => f.status === 'processing').length}
                </span>
              </div>
            )}
            {fileStatuses.some(f => f.status === 'completed') && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-950/30 border border-green-900/50 rounded">
                <CheckCircle className="w-3 h-3 text-green-700" />
                <span className="text-sm font-bold text-green-600">
                  {fileStatuses.filter(f => f.status === 'completed').length}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Section - Dark Noble Card */}
      <div className="relative">
        {/* Main Card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          {/* Upload Buttons - Sadece readOnly değilse göster */}
          {!readOnly && (
            <div className="flex items-center justify-end gap-2 mb-4">
              <label className="cursor-pointer group/btn" htmlFor="document-file-input">
                <input
                  id="document-file-input"
                  name="document-files"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.json,.html"
                  onChange={handleFileInput}
                  className="hidden"
                  aria-label="PDF, Word, TXT, JSON veya resim dosyası yükle"
                />
                <div className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-600 text-slate-200 rounded-lg transition-all flex items-center gap-2 text-sm font-medium">
                  <Upload className="w-4 h-4" />
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
                    accept=".csv,.xls,.xlsx"
                    onChange={handleCSVInput}
                    className="hidden"
                    aria-label="CSV veya Excel maliyet dosyası yükle"
                  />
                  <div className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-600 text-slate-200 rounded-lg transition-all flex items-center gap-2 text-sm font-medium">
                    <span className="text-base">📊</span>
                    <span>CSV Ekle</span>
                  </div>
                </label>
              )}
            </div>
          )}

          {/* File List */}
          <div className="space-y-2">
          {fileStatuses.length === 0 ? (
            readOnly ? (
              <div className="text-center py-8 px-6 rounded-xl border border-slate-700 bg-slate-800/20">
                <FileText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">Henüz dosya yüklenmemiş</p>
              </div>
            ) : (
            <div 
              className={`
                text-center py-12 px-6 rounded-xl border-2 border-dashed transition-all
                ${isDragging 
                  ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' 
                  : 'border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/30'
                }
              `}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <motion.div
                initial={{ scale: 1 }}
                animate={{ scale: isDragging ? 1.05 : 1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="relative inline-block mb-4">
                  <div className={`absolute inset-0 blur-xl rounded-full transition-all ${isDragging ? 'bg-blue-500/30' : 'bg-blue-500/10'}`}></div>
                  <FileText className={`relative w-12 h-12 mx-auto transition-colors ${isDragging ? 'text-blue-400' : 'text-slate-500'}`} />
                </div>
              </motion.div>
              
              <h3 className="text-base font-bold text-white mb-1">
                {isDragging ? '📂 Dosyaları buraya bırakın' : 'Dosya Bekleniyor'}
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                {isDragging 
                  ? 'Serbest bırakın'
                  : 'Sürükle-bırak veya butona tıklayın'
                }
              </p>

              {/* Dosya Tipi Örnekleri - Kompakt */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded border border-slate-700/50">
                  <FileText className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-slate-500">PDF</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded border border-slate-700/50">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-500">Word</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded border border-slate-700/50">
                  <FileImage className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-slate-500">Resim</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 text-xs text-slate-600">
                <span>Max 50MB</span>
                <span>•</span>
                <span>Çoklu dosya</span>
              </div>
            </div>
            )
          ) : (
            <AnimatePresence mode="popLayout">
              {fileStatuses.map((file, index) => (
                <motion.div
                  key={file.fileMetadata.name}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -50, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className={`
                    group relative flex items-center gap-3 p-4 rounded-lg border
                    transition-all hover:scale-[1.01] hover:shadow-lg
                    ${file.status === 'processing' 
                      ? 'bg-blue-500/5 border-blue-600/30' 
                      : getStatusColor(file.status)
                    }
                  `}
                >
                  {/* Dosya Tipi İkonu */}
                  <div className="flex-shrink-0 transform group-hover:scale-105 transition-transform">
                    {getFileTypeIcon(file.fileMetadata.name)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className="font-medium text-white text-sm truncate">
                        {file.fileMetadata.name}
                      </h4>
                      
                      {/* Status Badge */}
                      <div className={`
                        flex items-center gap-1 px-2 py-0.5 rounded text-xs
                        ${file.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          file.status === 'processing' ? 'bg-blue-500/20 text-blue-400 animate-pulse' :
                          file.status === 'error' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }
                      `}>
                        {getStatusIcon(file.status)}
                        <span>{getStatusText(file)}</span>
                      </div>
                      
                      {file.detectedType && (
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">
                          {BELGE_TURU_LABELS[file.detectedType as BelgeTuru]}
                        </span>
                      )}
                    </div>
                    
                    {/* Dosya Bilgileri */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {/* 🆕 Dosya Formatı - Her zaman göster */}
                      <span className="px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded font-medium">
                        {getFileFormat(file.fileMetadata.name)}
                      </span>

                      <span>•</span>

                      <span>
                        {file.fileMetadata.size < 1024 * 1024
                          ? `${(file.fileMetadata.size / 1024).toFixed(1)} KB`
                          : `${(file.fileMetadata.size / 1024 / 1024).toFixed(2)} MB`
                        }
                      </span>

                      {file.status === 'completed' && file.wordCount && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400">
                            {file.wordCount.toLocaleString('tr-TR')} kelime
                          </span>
                        </>
                      )}
                    </div>

                    {/* 🆕 İçerik Önizlemesi (TXT/JSON/CSV için) */}
                    {file.extractedText && 
                     (file.fileMetadata.name.toLowerCase().endsWith('.txt') || 
                      file.fileMetadata.name.toLowerCase().endsWith('.json') ||
                      file.fileMetadata.name.toLowerCase().endsWith('.csv')) && (
                      <div className="mt-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-400">📄 Önizleme</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">
                              {file.extractedText.length} karakter
                            </span>
                            <button
                              onClick={() => setPreviewModal({ 
                                fileName: file.fileMetadata.name, 
                                content: file.extractedText || '' 
                              })}
                              className="p-1 hover:bg-slate-700 rounded transition-colors"
                              title="Tüm içeriği görüntüle"
                            >
                              <Eye className="w-3 h-3 text-blue-400" />
                            </button>
                          </div>
                        </div>
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap line-clamp-3 font-mono">
                          {file.extractedText.slice(0, 200)}
                          {file.extractedText.length > 200 && '...'}
                        </pre>
                      </div>
                    )}

                    {/* Progress Bar */}
                    {file.status === 'processing' && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all"
                            style={{ width: `${file.progressPercentage || 0}%` }}
                          ></div>
                        </div>
                        {file.progress && (
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-blue-400">{file.progress}</span>
                            <span className="text-slate-500">{file.progressPercentage || 0}%</span>
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
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                      aria-label={`${file.fileMetadata.name} dosyasını işle`}
                    >
                      İşle
                    </button>
                  )}
                  {file.status !== 'processing' && (
                    <button
                      onClick={() => onFileRemove(file.fileMetadata.name)}
                      className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                      title="Sil"
                      aria-label={`${file.fileMetadata.name} dosyasını sil`}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
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

      {/* 🚀 AI Analiz Başlat Butonu - Tüm dosyalar tamamlandığında göster */}
      {onStartAnalysis && 
       fileStatuses.length > 0 && 
       fileStatuses.every(f => f.status === 'completed') && 
       fileStatuses.some(f => f.extractedText && f.extractedText.trim().length > 0) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 p-6 bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-2 border-purple-600/50 rounded-xl shadow-xl"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg">
                  <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    🎯 Dosyalar Hazır!
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-semibold">
                      {fileStatuses.filter(fs => fs.status === 'completed').length} PDF/DOC
                    </span>
                  </h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      📄 {fileStatuses.reduce((sum, f) => sum + (f.wordCount || 0), 0).toLocaleString('tr-TR')} kelime
                    </span>
                    <span className="flex items-center gap-1">
                      💾 {(fileStatuses.reduce((sum, f) => sum + (f.size || 0), 0) / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 pl-16">
                <p className="text-sm text-purple-300">
                  ✨ Tüm dosyalar işlendi • AI analizi başlatmaya hazır
                </p>
                <button
                  onClick={onStartAnalysis}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 hover:from-purple-700 hover:via-purple-600 hover:to-blue-700 text-white rounded-xl font-bold transition-all flex items-center gap-3 shadow-lg hover:shadow-purple-500/50 transform hover:scale-105 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>AI ile Analiz Et</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 🆕 Önizleme Modal */}
      {previewModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewModal(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {previewModal.fileName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {previewModal.content.length.toLocaleString('tr-TR')} karakter
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewModal(null)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                title="Kapat"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono bg-slate-800/50 p-4 rounded-lg">
                {previewModal.content}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setPreviewModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
