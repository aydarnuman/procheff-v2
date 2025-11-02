"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import * as Icons from "lucide-react";

type IconName = "ChefHat" | "Plus" | "LayoutDashboard" | "TrendingUp" | "Users" | "Calendar";

const getIcon = (iconName: IconName) => {
  return Icons[iconName] as React.ComponentType<{ className?: string }>;
};

export default function MenuDashboard() {
  const stats = [
    {
      label: "Toplam Yemek",
      value: "0",
      iconName: "ChefHat" as IconName,
      color: "text-blue-400",
      bg: "bg-blue-500/20",
    },
    {
      label: "Aktif Menüler",
      value: "0",
      iconName: "Calendar" as IconName,
      color: "text-green-400",
      bg: "bg-green-500/20",
    },
    {
      label: "Kurumlar",
      value: "5",
      iconName: "Users" as IconName,
      color: "text-purple-400",
      bg: "bg-purple-500/20",
    },
    {
      label: "Bu Ay",
      value: "0",
      iconName: "TrendingUp" as IconName,
      color: "text-yellow-400",
      bg: "bg-yellow-500/20",
    },
  ];

  const quickActions = [
    {
      title: "Menü Havuzu",
      description: "Tüm yemekleri görüntüle ve kurumlar için yönet",
      href: "/menu-planner",
      iconName: "ChefHat" as IconName,
      color: "from-blue-500/20 to-cyan-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-platinum-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Menü Yönetimi</h1>
          <p className="text-gray-400">
            Menü havuzunu yönetin, yeni menüler oluşturun ve planlamalar yapın
          </p>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const StatIcon = getIcon(stat.iconName);
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.03 }}
                className="rounded-2xl bg-platinum-800/60 border border-platinum-700/40 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <div className="flex items-center justify-center mb-3">
                  <div className={`p-3 rounded-xl ${stat.bg}`}>
                    <StatIcon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <div className="text-sm text-surface-tertiary mb-1">
                  {stat.label}
                </div>
                <div className="text-2xl font-bold text-surface-primary">
                  {stat.value}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Hızlı Erişim */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Hızlı Erişim</h2>
          <div className="grid md:grid-cols-1 gap-6">
            {quickActions.map((action, index) => {
              const ActionIcon = getIcon(action.iconName);
              return (
                <Link key={action.title} href={action.href}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (index + 4) * 0.1 }}
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`group rounded-2xl bg-gradient-to-br ${action.color} border border-platinum-700/40 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer`}
                  >
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="p-3 rounded-xl bg-white/10 group-hover:bg-white/20 transition-colors">
                        <ActionIcon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        {action.title}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-300 group-hover:text-white transition-colors">
                      {action.description}
                    </p>
                    <div className="mt-4 flex items-center text-white text-sm font-medium">
                      Git
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
            })}
          </div>
        </div>

        {/* Son Aktiviteler */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Son Aktiviteler</h2>
          <div className="rounded-2xl bg-platinum-800/60 border border-platinum-700/40 p-6">
            <p className="text-center text-gray-400 py-8">
              Henüz aktivite bulunmuyor
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
