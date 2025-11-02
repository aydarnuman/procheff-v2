"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  FileText,
  ChefHat,
  BarChart3,
  Brain,
  TrendingUp,
  DollarSign,
  Shield,
  Activity,
} from "lucide-react";

type IconName = "FileText" | "ChefHat" | "BarChart3" | "Brain" | "TrendingUp" | "DollarSign" | "Shield" | "Activity";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-platinum-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-surface-primary">
            ProCheff AI v8.3.1
          </h1>
          <p className="text-lg text-surface-secondary">
            Doküman analizi ve AI destekli iş süreçleri - Sistem aktif ve hazır
          </p>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="API Durumu" value="Aktif" iconName="Activity" color="text-green-400" delay={0} />
          <StatCard label="Sistem Durumu" value="Online" iconName="Shield" color="text-blue-400" delay={0.1} />
          <StatCard label="AI Modeller" value="4/4" iconName="Brain" color="text-purple-400" delay={0.2} />
          <StatCard label="Hazır" value="100%" iconName="TrendingUp" color="text-yellow-400" delay={0.3} />
        </div>

        {/* Modül Kartları */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <ModuleCard
            title="Şartname Analizi"
            description="PDF/DOCX şartname yükle ve AI analizi yap"
            iconName="FileText"
            href="/ihale"
            delay={0.4}
          />
          <ModuleCard
            title="Teklif Optimizasyonu"
            description="Maliyet analizi ve teklif oluşturma"
            iconName="TrendingUp"
            href="/ihale/teklif-olustur"
            delay={0.5}
          />
          <ModuleCard
            title="İhale Raporları"
            description="Detaylı performans ve kazanım analizi"
            iconName="BarChart3"
            href="/analytics"
            delay={0.6}
          />
          <ModuleCard
            title="Menü Planlama"
            description="AI destekli menü planlama ve maliyet hesabı"
            iconName="ChefHat"
            href="/menu-planner"
            delay={0.7}
          />
          <ModuleCard
            title="Fiyat Takip"
            description="Anlık piyasa fiyatları ve trend analizi"
            iconName="DollarSign"
            href="/price-feed"
            delay={0.8}
          />
          <ModuleCard
            title="AI Ayarları"
            description="Model parametreleri ve özelleştirmeler"
            iconName="Brain"
            href="/ai-settings"
            delay={0.9}
          />
        </div>

        {/* Alt Bilgi */}
        <div className="text-center py-6">
          <div className="inline-flex items-center space-x-2 text-surface-tertiary">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Sistem Durumu: Aktif</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  iconName: IconName;
  color: string;
  delay: number;
}

function StatCard({ label, value, iconName, color, delay }: StatCardProps) {
  const getIcon = () => {
    switch (iconName) {
      case "Activity": return Activity;
      case "Shield": return Shield;
      case "Brain": return Brain;
      case "TrendingUp": return TrendingUp;
      case "FileText": return FileText;
      case "ChefHat": return ChefHat;
      case "BarChart3": return BarChart3;
      case "DollarSign": return DollarSign;
      default: return Activity;
    }
  };

  const Icon = getIcon();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.03 }}
      className="rounded-2xl bg-platinum-800/60 border border-platinum-700/40 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-200"
    >
      <div className="flex items-center justify-center mb-3">
        <Icon className={`w-8 h-8 ${color}`} />
      </div>
      <div className="text-sm text-surface-tertiary mb-1">{label}</div>
      <div className="text-2xl font-bold text-surface-primary">{value}</div>
    </motion.div>
  );
}

interface ModuleCardProps {
  title: string;
  description: string;
  iconName: IconName;
  href: string;
  delay: number;
}

function ModuleCard({ title, description, iconName, href, delay }: ModuleCardProps) {
  const getIcon = () => {
    switch (iconName) {
      case "FileText": return FileText;
      case "TrendingUp": return TrendingUp;
      case "BarChart3": return BarChart3;
      case "ChefHat": return ChefHat;
      case "DollarSign": return DollarSign;
      case "Brain": return Brain;
      case "Shield": return Shield;
      case "Activity": return Activity;
      default: return FileText;
    }
  };

  const Icon = getIcon();

  return (
    <Link href={href}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        whileHover={{ y: -4, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="group rounded-2xl bg-linear-to-br from-accent-500/20 to-purple-500/20 border border-platinum-700/40 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer"
      >
        <div className="flex items-center space-x-4 mb-4">
          <div className="p-3 rounded-xl bg-accent-500/20 group-hover:bg-accent-500/30 transition-colors">
            <Icon className="w-6 h-6 text-accent-400" />
          </div>
          <h3 className="text-lg font-semibold text-surface-primary group-hover:text-accent-300 transition-colors">
            {title}
          </h3>
        </div>
        <p className="text-sm text-surface-secondary group-hover:text-surface-primary transition-colors">
          {description}
        </p>
        <div className="mt-4 flex items-center text-accent-400 text-sm font-medium">
          Modüle Git
          <svg
            className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </motion.div>
    </Link>
  );
}
