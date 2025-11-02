"use client";

import { Bell, Search, Settings, User } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "./ThemeToggle";
import { usePathname } from "next/navigation";

const pageNames: Record<string, string> = {
  "/": "Ana Panel",
  "/ihale": "İhale Analizi",
  "/menu": "Menü Yönetimi",
  "/menu-planner": "Menü Planlama",
  "/price-feed": "Market Fiyatları",
  "/analytics": "Raporlar",
  "/ai-settings": "AI Ayarları",
  "/health-monitor": "Performans İzleme",
};

export function Topbar() {
  const pathname = usePathname();
  const currentPageName = pageNames[pathname] || "ProCheff AI";

  return (
    <header className="h-14 bg-[rgba(30,30,40,0.6)] backdrop-blur-xl border-b border-gray-800/40 flex items-center justify-between px-4">
      {/* Sol taraf - Sayfa başlığı ve arama */}
      <div className="flex items-center space-x-4">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold text-white">
            {currentPageName}
          </h1>
          <p className="text-xs text-gray-400">
            {new Date().toLocaleDateString("tr-TR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Arama kutusu */}
        <div className="hidden md:flex items-center relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3" />
          <input
            type="text"
            placeholder="Ara..."
            className="pl-10 pr-4 py-2 w-64 bg-[rgba(255,255,255,0.05)] border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Sağ taraf - Action buttons */}
      <div className="flex items-center space-x-2">
        {/* Bildirimler */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-9 h-9 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-colors flex items-center justify-center group"
        >
          <Bell className="w-4 h-4 text-gray-300 group-hover:text-white transition-colors" />
          {/* Bildirim badge */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-xs text-white font-bold">3</span>
          </div>
          <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-20 bg-linear-to-r from-blue-400 to-purple-500 transition-opacity duration-300" />
        </motion.button>

        {/* Ayarlar */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-9 h-9 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-colors flex items-center justify-center group"
        >
          <Settings className="w-4 h-4 text-gray-300 group-hover:text-white transition-colors" />
          <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-20 bg-linear-to-r from-blue-400 to-purple-500 transition-opacity duration-300" />
        </motion.button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Profil */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-9 h-9 rounded-lg bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all flex items-center justify-center group"
        >
          <User className="w-4 h-4 text-white" />
        </motion.button>

        {/* AI Durumu göstergesi */}
        <div className="hidden lg:flex items-center space-x-2 ml-4 px-3 py-1 bg-[rgba(34,197,94,0.1)] border border-green-500/30 rounded-lg">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-green-400 font-medium">AI Aktif</span>
        </div>
      </div>
    </header>
  );
}
