"use client";

import { APIKeyValidator } from "@/components/ai/APIKeyValidator";

export default function AISettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          AI Ayarları
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          AI provider ayarlarını yönetin ve API anahtarlarını test edin
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <APIKeyValidator />
      </div>
    </div>
  );
}
