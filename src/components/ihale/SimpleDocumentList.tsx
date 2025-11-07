'use client';

import { FileProcessingStatus, CSVFileStatus } from '@/lib/stores/ihale-store';
import { BelgeTuru, BELGE_TURU_LABELS } from '@/types/ai';
import { FileText, Trash2, CheckCircle, AlertCircle, Loader2, Upload } from 'lucide-react';
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
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Stage Indicator - Outside Card */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/30 blur-lg rounded-xl"></div>
          <div className="relative px-4 py-2 bg-gradient-to-r from-blue-500/30 to-blue-600/20 border border-blue-400/50 rounded-xl shadow-lg shadow-blue-500/20">
            <span className="text-blue-300 font-bold text-base tracking-wide">1️⃣ İLK AŞAMA</span>
          </div>
        </div>
        <div className="h-8 w-px bg-gradient-to-b from-transparent via-slate-600 to-transparent"></div>
        <h3 className="text-2xl font-bold text-white tracking-tight">Dosya İşleme (OCR)</h3>
        <div className="flex-1"></div>
        
        {/* 🆕 Enhanced Stats with Colors */}
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

      {/* Upload Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-end gap-3 mb-4">
          <label className="cursor-pointer" htmlFor="document-file-input">
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
            <div className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium">
              <Upload className="w-5 h-5" />
              Belge Ekle
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
              <div className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium">
                📊 CSV Ekle
              </div>
            </label>
          )}
        </div>

        {/* File List */}
        <div className="space-y-2">
          {fileStatuses.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full"></div>
                <FileText className="relative w-20 h-20 mx-auto text-blue-400/60" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Henüz dosya eklenmedi
              </h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                PDF, Word veya resim dosyalarını yükleyerek analiz sürecini başlatın
              </p>
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
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${getStatusColor(file.status)}`}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {getStatusIcon(file.status)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-white truncate">
                      {file.fileMetadata.name}
                    </h4>
                    {file.detectedType && (
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs font-medium flex-shrink-0">
                        {BELGE_TURU_LABELS[file.detectedType as BelgeTuru]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm">
                    <span className="text-gray-400">
                      {(file.fileMetadata.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <span className={
                      file.status === 'completed' ? 'text-green-400' :
                      file.status === 'processing' ? 'text-blue-400' :
                      file.status === 'error' ? 'text-red-400' :
                      'text-yellow-400'
                    }>
                      {getStatusText(file)}
                    </span>
                  </div>

                  {/* Progress Bar for Processing */}
                  {file.status === 'processing' && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 bg-slate-900/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                          style={{ width: `${file.progressPercentage || 0}%` }}
                        />
                      </div>
                      {file.progress && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-blue-400">{file.progress}</span>
                          <span className="text-gray-500 font-mono">{file.progressPercentage || 0}%</span>
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

      {/* Summary */}
      {(fileStatuses.length > 0 || csvFiles.length > 0) && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">
              {fileStatuses.length + csvFiles.length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Toplam Dosya</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-400">
              {fileStatuses.filter(f => f.status === 'pending').length + csvFiles.filter(c => c.status === 'pending').length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Bekliyor</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">
              {fileStatuses.filter(f => f.status === 'processing').length + csvFiles.filter(c => c.status === 'processing').length}
            </div>
            <div className="text-sm text-gray-400 mt-1">İşleniyor</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">
              {fileStatuses.filter(f => f.status === 'completed').length + csvFiles.filter(c => c.status === 'completed').length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Tamamlandı</div>
          </div>
        </div>
      )}
    </div>
  );
}
