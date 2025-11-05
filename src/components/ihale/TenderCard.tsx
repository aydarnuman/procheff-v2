'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Building2, MapPin, Calendar, TrendingUp, FileText, Utensils, Bot } from 'lucide-react';

/**
 * Tender Card Component
 *
 * Ortak ihale kartı bileşeni - İhale Takip ve Yeni Analiz sayfalarında kullanılır
 * Mode: 'dashboard' (İhale Takip) veya 'select' (Yeni Analiz modal)
 */

export interface Tender {
  id: string;
  source: string;
  source_id: string;
  source_url: string;
  title: string;
  organization: string;
  organization_city: string | null;
  budget: number | null;
  currency: string;
  announcement_date: string | null;
  deadline_date: string | null;
  tender_date: string | null;
  tender_type: string | null;
  procurement_type: string | null;
  category: string | null;
  is_catering: boolean;
  catering_confidence: number;
  specification_url?: string | null;
  announcement_text?: string | null;
  ai_analyzed: boolean;
  ai_analyzed_at: string | null;
  registration_number?: string | null;
  raw_json?: {
    'Kayıt no'?: string;
    documents?: Array<{
      title: string;
      url: string;
      type: 'idari_sartname' | 'teknik_sartname' | 'ek_dosya' | 'diger';
    }>;
  };
  total_items?: number;
  total_meal_quantity?: number;
  estimated_budget_from_items?: number;
  first_seen_at: string;
  last_updated_at: string;
}

interface TenderCardProps {
  tender: Tender;
  mode: 'dashboard' | 'select';
  onClick?: (tender: Tender) => void;
  onViewDetails?: (tender: Tender) => void;
  onAnalyze?: (tender: Tender) => void;
  index?: number;
}

export const TenderCard: React.FC<TenderCardProps> = ({
  tender,
  mode,
  onClick,
  onViewDetails,
  onAnalyze,
  index = 0
}) => {
  const handleClick = () => {
    if (mode === 'select' && onClick) {
      onClick(tender);
    }
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (onViewDetails) {
      onViewDetails(tender);
    }
  };

  const handleAnalyze = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (onAnalyze) {
      onAnalyze(tender);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  const formatBudget = (budget: number | null) => {
    if (!budget || budget === 0) return 'Belirtilmemiş';
    return `${budget.toLocaleString('tr-TR')} ${tender.currency}`;
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source.toLowerCase()) {
      case 'ihalebul':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'ekap':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const isExpiringSoon = () => {
    if (!tender.deadline_date) return false;
    const deadline = new Date(tender.deadline_date);
    const now = new Date();
    const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDeadline <= 7 && daysUntilDeadline >= 0;
  };

  const isExpired = () => {
    if (!tender.deadline_date) return false;
    const deadline = new Date(tender.deadline_date);
    const now = new Date();
    return deadline < now;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={handleClick}
      className={`
        bg-gradient-to-br from-gray-800/50 to-gray-900/50
        rounded-xl p-6 border border-gray-700/50
        hover:border-emerald-500/50 transition-all duration-300
        flex flex-col h-full
        ${mode === 'select' ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-500/10' : ''}
        ${isExpired() ? 'opacity-60' : ''}
      `}
    >
      {/* Main Content - Flex Grow */}
      <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {/* Title */}
          <h3 className="text-lg font-semibold text-surface-primary mb-2 line-clamp-2">
            {tender.title}
          </h3>

          {/* Organization */}
          <div className="flex items-center text-surface-secondary text-sm mb-1">
            <Building2 className="w-4 h-4 mr-2 text-emerald-400" />
            <span className="line-clamp-1">{tender.organization}</span>
          </div>

          {/* City */}
          {tender.organization_city && (
            <div className="flex items-center text-surface-secondary text-sm">
              <MapPin className="w-4 h-4 mr-2 text-blue-400" />
              <span>{tender.organization_city}</span>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-col gap-2 ml-4">
          {/* Source Badge */}
          <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${getSourceBadgeColor(tender.source)}`}>
            {tender.source.toUpperCase()}
          </span>

          {/* Catering Badge */}
          {tender.is_catering && (
            <span className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <Utensils className="w-3 h-3" />
              Yemek
            </span>
          )}

          {/* AI Analyzed Badge */}
          {tender.ai_analyzed && (
            <span className="px-3 py-1 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
              AI
            </span>
          )}

          {/* Expiring Soon Badge */}
          {isExpiringSoon() && !isExpired() && (
            <span className="px-3 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
              Yakında
            </span>
          )}

          {/* Expired Badge */}
          {isExpired() && (
            <span className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
              Süresi Doldu
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent my-4" />

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Announcement Date */}
        {tender.announcement_date && (
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-surface-secondary">İlan Tarihi</div>
              <div className="text-sm font-medium text-surface-primary">
                {formatDate(tender.announcement_date)}
              </div>
            </div>
          </div>
        )}

        {/* Deadline Date */}
        {tender.deadline_date && (
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-surface-secondary">Son Başvuru</div>
              <div className={`text-sm font-medium ${isExpiringSoon() ? 'text-red-400' : 'text-surface-primary'}`}>
                {formatDate(tender.deadline_date)}
              </div>
            </div>
          </div>
        )}

        {/* Budget */}
        <div className="flex items-start gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs text-surface-secondary">Bütçe</div>
            <div className="text-sm font-medium text-surface-primary">
              {formatBudget(tender.budget)}
            </div>
          </div>
        </div>

        {/* Tender Type */}
        {tender.tender_type && (
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-surface-secondary">İhale Türü</div>
              <div className="text-sm font-medium text-surface-primary line-clamp-1">
                {tender.tender_type}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Extra Info & Buttons (Dashboard Mode Only) - Fixed at bottom */}
      {mode === 'dashboard' && (
        <div className="mt-auto">
          {/* Registration Number */}
          {(tender.registration_number || tender.raw_json?.['Kayıt no']) && (
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <div className="text-xs text-surface-secondary mb-1">Kayıt No</div>
              <div className="text-sm font-mono text-emerald-400">
                {tender.registration_number || tender.raw_json?.['Kayıt no']}
              </div>
            </div>
          )}

          {/* Documents Count */}
          {tender.raw_json?.documents && tender.raw_json.documents.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-surface-secondary mb-1">Belgeler</div>
              <div className="text-sm text-blue-400">
                {tender.raw_json.documents.length} dosya
              </div>
            </div>
          )}

          {/* Action Button - Tek buton */}
          {onAnalyze && (
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <button
                onClick={handleAnalyze}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/30 font-medium"
                title="AI Analiz"
              >
                <Bot className="w-5 h-5" />
                <span>AI Analiz</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Select Mode Indicator - Fixed at bottom */}
      {mode === 'select' && (
        <div className="mt-auto pt-4 border-t border-gray-700/50">
          <div className="text-xs text-emerald-400 text-center font-medium">
            📋 Seçmek için tıklayın
          </div>
        </div>
      )}
    </motion.div>
  );
};
