"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Zap, Flame, Fuel } from "lucide-react";

interface OperationalItem {
  id: string;
  name: string;
  monthlyAmount: number;
  icon?: string;
}

interface OperationalCardProps {
  data: {
    items: OperationalItem[];
    contractDays: number;
  };
  onChange: (data: any) => void;
  contractDays?: number;
}

const DEFAULT_ITEMS: OperationalItem[] = [
  { id: "elektrik", name: "Elektrik", monthlyAmount: 0, icon: "zap" },
  { id: "dogalgaz", name: "Doğalgaz", monthlyAmount: 0, icon: "flame" },
  { id: "yakit", name: "Yakıt", monthlyAmount: 0, icon: "fuel" },
];

const ICON_MAP: Record<string, any> = {
  zap: Zap,
  flame: Flame,
  fuel: Fuel,
};

export function OperationalCard({ data, onChange, contractDays = 365 }: OperationalCardProps) {
  const [items, setItems] = useState<OperationalItem[]>(
    data?.items?.length > 0 ? data.items : DEFAULT_ITEMS
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");

  // İhale dönemine göre hesaplama (aylık × (gün ÷ 30))
  const calculateContractTotal = (monthly: number) => {
    return (monthly / 30) * contractDays;
  };

  const handleUpdateItem = (id: string, field: string, value: any) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    setItems(updated);
    onChange({ items: updated, contractDays });
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    onChange({ items: updated, contractDays });
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) {
      alert("Lütfen kalem adı girin!");
      return;
    }

    const newItem: OperationalItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      monthlyAmount: parseFloat(newItemAmount) || 0,
    };

    const updated = [...items, newItem];
    setItems(updated);
    onChange({ items: updated, contractDays });

    // Reset form
    setNewItemName("");
    setNewItemAmount("");
    setShowAddModal(false);
  };

  const monthlyTotal = items.reduce((sum, item) => sum + item.monthlyAmount, 0);
  const contractTotal = items.reduce(
    (sum, item) => sum + calculateContractTotal(item.monthlyAmount),
    0
  );

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 px-6 py-4 border-b-2 border-orange-500/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Zap className="text-orange-400" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Operasyonel Giderler</h3>
              <p className="text-sm text-gray-400">
                İhale Süresi: <strong>{contractDays} gün</strong> (AI'dan otomatik)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

      {/* Items List */}
      <div className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon ? ICON_MAP[item.icon] : null;
          const contractAmount = calculateContractTotal(item.monthlyAmount);

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                {Icon && (
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Icon className="w-5 h-5 text-orange-400" />
                  </div>
                )}

                {/* Name */}
                <div className="flex-1">
                  <p className="text-white font-medium">{item.name}</p>
                </div>

                {/* Monthly Input */}
                <div className="w-40">
                  <div className="relative">
                    <input
                      type="number"
                      value={item.monthlyAmount || ""}
                      onChange={(e) =>
                        handleUpdateItem(
                          item.id,
                          "monthlyAmount",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2 text-gray-400 text-xs">
                      TL/ay
                    </span>
                  </div>
                </div>

                {/* Contract Total (Read-only) */}
                <div className="w-48 text-right">
                  <p className="text-green-400 font-semibold">
                    {contractAmount.toLocaleString("tr-TR", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}{" "}
                    TL
                  </p>
                  <p className="text-xs text-gray-400">({contractDays} gün)</p>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  title="Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add New Item Button */}
      {!showAddModal && (
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-orange-500 hover:text-orange-400 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Yeni Kalem Ekle
        </button>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3"
        >
          <h4 className="text-white font-semibold">Yeni Kalem Ekle</h4>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Kalem Adı</label>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white focus:border-orange-500 focus:outline-none"
              placeholder="örn: Su, Temizlik Malzemeleri"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Aylık Tutar (TL)</label>
            <input
              type="number"
              value={newItemAmount}
              onChange={(e) => setNewItemAmount(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white focus:border-orange-500 focus:outline-none"
              placeholder="0"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAddModal(false)}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleAddItem}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
            >
              Ekle
            </button>
          </div>
        </motion.div>
      )}

      {/* Summary */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Aylık Toplam:</span>
          <span className="text-white font-semibold">
            {monthlyTotal.toLocaleString("tr-TR")} TL/ay
          </span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-700">
          <span className="text-gray-300 font-medium">İhale Dönemi Toplamı:</span>
          <span className="text-green-400 text-lg font-bold">
            {contractTotal.toLocaleString("tr-TR", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}{" "}
            TL
          </span>
        </div>
        <p className="text-xs text-gray-500 text-right">({contractDays} gün)</p>
      </div>
      </div>
    </div>
  );
}
