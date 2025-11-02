'use client';

import { FileProcessingStatus, CSVFileStatus } from '@/lib/stores/ihale-store';
import { BelgeTuru, BELGE_TURU_LABELS } from '@/types/ai';
import { FileText, Trash2, CheckCircle, AlertCircle, Loader2, Upload } from 'lucide-react';

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
      {/* Upload Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Belgeler</h3>
            <p className="text-sm text-gray-400 mt-1">
              {fileStatuses.length} dosya • {fileStatuses.filter(f => f.status === 'completed').length} işlendi
            </p>
          </div>
          <div className="flex gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={handleFileInput}
                className="hidden"
              />
              <div className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium">
                <Upload className="w-5 h-5" />
                Belge Ekle
              </div>
            </label>

            {onCSVSelect && (
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept=".csv"
                  onChange={handleCSVInput}
                  className="hidden"
                />
                <div className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium">
                  📊 CSV Ekle
                </div>
              </label>
            )}
          </div>
        </div>

        {/* File List */}
        <div className="space-y-2">
          {fileStatuses.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Henüz dosya eklenmedi</p>
              <p className="text-sm mt-2">PDF, Word veya resim dosyalarını yükleyin</p>
            </div>
          ) : (
            fileStatuses.map((file, index) => (
              <div
                key={file.fileMetadata.name}
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
                    >
                      İşle
                    </button>
                  )}
                  {file.status !== 'processing' && (
                    <button
                      onClick={() => onFileRemove(file.fileMetadata.name)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            ))
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
                  >
                    İşle
                  </button>
                )}
                {csv.status !== 'processing' && onCSVRemove && (
                  <button
                    onClick={() => onCSVRemove(csv.fileMetadata.name)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Sil"
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
