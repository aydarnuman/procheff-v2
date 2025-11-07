"use client";

import { useState, useEffect } from "react";
import { Wrench, Plus, Trash2, ShoppingCart, CheckCircle } from "lucide-react";

interface EquipmentItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  isPurchased: boolean; // Alınacak mı yoksa mevcut mu?
  notes?: string;
}

interface EquipmentCardProps {
  data: EquipmentItem[];
  onChange: (data: EquipmentItem[]) => void;
}

const DEFAULT_EQUIPMENT: Partial<EquipmentItem>[] = [
  { name: "Endüstriyel Buzdolabı", quantity: 0, unitPrice: 0, isPurchased: false },
  { name: "Endüstriyel Fırın", quantity: 0, unitPrice: 0, isPurchased: false },
  { name: "Ocak (4 Gözlü)", quantity: 0, unitPrice: 0, isPurchased: false },
  { name: "Derin Dondurucu", quantity: 0, unitPrice: 0, isPurchased: false },
  { name: "Tencere Seti", quantity: 0, unitPrice: 0, isPurchased: false },
  { name: "Tabak Seti", quantity: 0, unitPrice: 0, isPurchased: false },
  { name: "Çatal/Kaşık Seti", quantity: 0, unitPrice: 0, isPurchased: false },
];

export function EquipmentCard({ data, onChange }: EquipmentCardProps) {
  const [equipment, setEquipment] = useState<EquipmentItem[]>(
    data.length > 0
      ? data
      : DEFAULT_EQUIPMENT.map((item, idx) => ({
          id: `default-${idx}`,
          name: item.name || "",
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          isPurchased: item.isPurchased || false,
          notes: "",
        }))
  );

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(num);
  };

  const calculateTotalCost = () => {
    return equipment.reduce((sum, item) => {
      if (item.isPurchased) {
        return sum + item.quantity * item.unitPrice;
      }
      return sum;
    }, 0);
  };

  const purchasedCount = equipment.filter((e) => e.isPurchased).length;
  const existingCount = equipment.filter((e) => !e.isPurchased).length;
  const totalCost = calculateTotalCost();

  useEffect(() => {
    onChange(equipment);
  }, [equipment]);

  const handleAdd = () => {
    const newItem: EquipmentItem = {
      id: Date.now().toString(),
      name: "",
      quantity: 0,
      unitPrice: 0,
      isPurchased: false,
      notes: "",
    };
    setEquipment([...equipment, newItem]);
  };

  const handleDelete = (id: string) => {
    setEquipment(equipment.filter((item) => item.id !== id));
  };

  const handleChange = (id: string, field: keyof EquipmentItem, value: any) => {
    setEquipment(
      equipment.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wrench className="w-7 h-7 text-yellow-400" />
            Demirbaş / Ekipman
          </h3>
          <p className="text-gray-400 mt-1">
            Mutfak ekipmanları ve demirbaş malzemeler
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Ekipman Ekle</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-gradient-to-br from-yellow-600/10 to-yellow-600/5 border border-yellow-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Toplam Ekipman</p>
          <p className="text-2xl font-bold text-yellow-400">{equipment.length}</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-blue-600/10 to-blue-600/5 border border-blue-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Alınacak / Mevcut</p>
          <p className="text-2xl font-bold text-blue-400">
            {purchasedCount} / {existingCount}
          </p>
        </div>
        <div className="p-4 bg-gradient-to-br from-green-600/10 to-green-600/5 border border-green-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Alım Maliyeti</p>
          <p className="text-2xl font-bold text-green-400">
            {formatCurrency(totalCost)}
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <ShoppingCart className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-blue-300 font-medium">Alım Planlaması</p>
            <p className="text-xs text-gray-400 mt-1">
              <strong>"Alınacak"</strong> işaretli ekipmanlar maliyet hesaplamasına dahil edilir.
              <strong> "Mevcut"</strong> işaretliler sadece envanter takibi için listelenir.
            </p>
          </div>
        </div>
      </div>

      {/* Equipment Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-b border-gray-700">
              <th className="px-4 py-3 text-left text-sm font-semibold text-white w-10">
                Durum
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                Ekipman Adı
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white w-24">
                Adet
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white w-32">
                Birim Fiyat
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-white w-32">
                Toplam
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white w-20">
                İşlem
              </th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((item, index) => {
              const rowCost = item.quantity * item.unitPrice;
              return (
                <tr
                  key={item.id}
                  className={`border-b border-gray-800 ${
                    index % 2 === 0 ? "bg-gray-900/30" : "bg-gray-900/10"
                  } hover:bg-gray-800/50 transition-colors`}
                >
                  {/* Alınacak/Mevcut Checkbox */}
                  <td className="px-4 py-3">
                    <label className="flex items-center justify-center cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={item.isPurchased}
                        onChange={(e) =>
                          handleChange(item.id, "isPurchased", e.target.checked)
                        }
                        className="w-5 h-5 rounded border-gray-600 text-green-500 focus:ring-green-500"
                        title={item.isPurchased ? "Alınacak" : "Mevcut"}
                      />
                      {item.isPurchased ? (
                        <ShoppingCart className="w-4 h-4 text-green-400 ml-2" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-gray-500 ml-2" />
                      )}
                    </label>
                  </td>

                  {/* Ekipman Adı */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleChange(item.id, "name", e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-colors"
                      placeholder="Ekipman adı girin..."
                    />
                  </td>

                  {/* Adet */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={item.quantity || ""}
                      onChange={(e) =>
                        handleChange(item.id, "quantity", parseInt(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm text-center focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-colors"
                      placeholder="0"
                      min="0"
                    />
                  </td>

                  {/* Birim Fiyat */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitPrice || ""}
                      onChange={(e) =>
                        handleChange(item.id, "unitPrice", parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm text-right focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-colors"
                      placeholder="0.00"
                    />
                  </td>

                  {/* Toplam */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-semibold ${
                        item.isPurchased ? "text-green-400" : "text-gray-500"
                      }`}
                    >
                      {formatCurrency(item.isPurchased ? rowCost : 0)}
                    </span>
                  </td>

                  {/* Sil */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 hover:bg-red-600/20 rounded transition-colors group"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-400" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-t-2 border-green-500/50">
              <td
                colSpan={4}
                className="px-4 py-4 text-right text-white font-bold text-lg"
              >
                TOPLAM ALIM MALİYETİ
              </td>
              <td className="px-4 py-4 text-right">
                <span className="text-green-400 font-bold text-xl">
                  {formatCurrency(totalCost)}
                </span>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
        <label htmlFor="equipment-notes" className="block text-sm font-medium text-gray-400 mb-2">
          Ekipman Notları
        </label>
        <textarea
          id="equipment-notes"
          name="equipment-notes"
          placeholder="Ekipman tedariki, bakım, özel şartlar hakkında notlarınızı buraya yazabilirsiniz..."
          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-colors resize-none"
          rows={3}
        />
      </div>
    </div>
  );
}
