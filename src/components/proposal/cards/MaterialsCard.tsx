"use client";

import { useState, useEffect } from "react";
import { Package, Plus, Trash2, TrendingUp, DollarSign } from "lucide-react";
import { AIAnalysisResult, KritikMalzeme } from "@/types/ai";

interface MaterialsCardProps {
  data: any;
  analysis: AIAnalysisResult;
  onChange: (data: any) => void;
}

interface MaterialRow extends KritikMalzeme {
  id: string;
  birim_fiyat?: number;
  toplam_miktar?: number;
  aciklama?: string;
}

export function MaterialsCard({ data, analysis, onChange }: MaterialsCardProps) {
  const [localData, setLocalData] = useState<MaterialRow[]>(
    data.length > 0
      ? data
      : (analysis?.extracted_data?.kritik_malzemeler || []).map((item, idx) => ({
          id: `ai-${idx}`,
          ...item,
          birim_fiyat: 0,
          toplam_miktar: 0,
        }))
  );

  // Format currency
  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(num);
  };

  // Calculate total cost
  const calculateTotalCost = () => {
    return localData.reduce((sum, row) => {
      const birimFiyat = row.birim_fiyat || 0;
      const toplamMiktar = row.toplam_miktar || 0;
      return sum + birimFiyat * toplamMiktar;
    }, 0);
  };

  const totalCost = calculateTotalCost();

  // Parent'a değişiklikleri ilet
  useEffect(() => {
    onChange(localData);
  }, [localData]);

  const handleAdd = () => {
    const newRow: MaterialRow = {
      id: Date.now().toString(),
      yemek_adi: "",
      malzeme: "",
      gramaj: "",
      birim_fiyat: 0,
      toplam_miktar: 0,
      aciklama: "",
    };
    setLocalData([...localData, newRow]);
  };

  const handleDelete = (id: string) => {
    setLocalData(localData.filter((row) => row.id !== id));
  };

  const handleChange = (id: string, field: keyof MaterialRow, value: any) => {
    setLocalData(
      localData.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  if (localData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white">Kritik Malzeme Yönetimi</h3>
            <p className="text-gray-400 mt-1">
              Menüdeki maliyetli malzemeler (et, tavuk, balık vb.)
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Malzeme Ekle</span>
          </button>
        </div>

        <div className="p-12 bg-gray-900/50 border-2 border-dashed border-gray-700 rounded-xl text-center">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">Kritik Malzeme Bulunamadı</p>
          <p className="text-gray-500 text-sm mb-6">
            İhale dökümanında kritik malzeme bilgisi tespit edilemedi.<br />
            Manuel olarak ekleyebilirsiniz.
          </p>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>İlk Malzemeyi Ekle</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white">Kritik Malzeme Yönetimi</h3>
          <p className="text-gray-400 mt-1">
            Menüdeki maliyetli malzemeler - Birim fiyat ve toplam miktar girebilirsiniz
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Malzeme Ekle</span>
        </button>
      </div>

      {/* AI Öneri Kutusu */}
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Package className="w-5 h-5 text-yellow-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-yellow-300 font-medium">AI Önerisi</p>
            <p className="text-xs text-gray-400 mt-1">
              {localData.length > 0
                ? `Menüden ${localData.length} kritik malzeme tespit edildi. Sadece MALİYETLİ malzemeler (et, tavuk, balık) burada listeleniyor. Birim fiyat ve toplam miktar ekleyerek maliyet hesaplayabilirsiniz.`
                : "Menüden kritik malzeme çıkarılamadı. Manuel olarak ekleyebilirsiniz."}
            </p>
          </div>
        </div>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-gradient-to-br from-yellow-600/10 to-yellow-600/5 border border-yellow-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Toplam Malzeme</p>
          <p className="text-2xl font-bold text-yellow-400">{localData.length}</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-green-600/10 to-green-600/5 border border-green-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Tahmini Maliyet</p>
          <p className="text-2xl font-bold text-green-400">
            {formatCurrency(totalCost)}
          </p>
        </div>
        <div className="p-4 bg-gradient-to-br from-orange-600/10 to-orange-600/5 border border-orange-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Et Ürünleri</p>
          <p className="text-2xl font-bold text-orange-400">
            {localData.filter((m) =>
              m.malzeme?.toLowerCase().includes("et") ||
              m.malzeme?.toLowerCase().includes("dana") ||
              m.malzeme?.toLowerCase().includes("kuzu")
            ).length}
          </p>
        </div>
      </div>

      {/* Malzeme Tablosu */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-b border-gray-700">
              <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                Yemek Adı
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                Malzeme
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                Gramaj/Porsiyon
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                Birim Fiyat
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                Toplam Miktar (kg)
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-white">
                Toplam Maliyet
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                İşlem
              </th>
            </tr>
          </thead>
          <tbody>
            {localData.map((row, index) => {
              const rowCost = (row.birim_fiyat || 0) * (row.toplam_miktar || 0);
              return (
                <tr
                  key={row.id}
                  className={`border-b border-gray-800 ${
                    index % 2 === 0 ? "bg-gray-900/30" : "bg-gray-900/10"
                  } hover:bg-gray-800/50 transition-colors`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.yemek_adi}
                      onChange={(e) =>
                        handleChange(row.id, "yemek_adi", e.target.value)
                      }
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-colors"
                      placeholder="Örn: Orman Kebabı"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.malzeme}
                      onChange={(e) =>
                        handleChange(row.id, "malzeme", e.target.value)
                      }
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-colors"
                      placeholder="Örn: Dana eti"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.gramaj}
                      onChange={(e) =>
                        handleChange(row.id, "gramaj", e.target.value)
                      }
                      className="w-28 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm text-center focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-colors"
                      placeholder="60gr"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={row.birim_fiyat || 0}
                      onChange={(e) =>
                        handleChange(
                          row.id,
                          "birim_fiyat",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-32 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm text-right focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-colors"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.1"
                      value={row.toplam_miktar || 0}
                      onChange={(e) =>
                        handleChange(
                          row.id,
                          "toplam_miktar",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-28 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm text-center focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-colors"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-green-400 font-semibold">
                      {formatCurrency(rowCost)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(row.id)}
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
                colSpan={5}
                className="px-4 py-4 text-right text-white font-bold text-lg"
              >
                TOPLAM KRİTİK MALZEME MALİYETİ
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

      {/* Bilgi Kartı */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-blue-300 font-medium">Maliyet Takibi</p>
            <p className="text-xs text-gray-400 mt-1">
              Bu liste SADECE kritik malzemeleri (et, tavuk, balık gibi maliyetli ürünler) içerir.
              Sebze, baharat, pirinç gibi düşük maliyetli malzemeler buraya dahil DEĞİLDİR.
              Toplam maliyet hesabınıza bu malzemeleri de eklemeyi unutmayın.
            </p>
          </div>
        </div>
      </div>

      {/* Açıklama/Notlar */}
      <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
        <label htmlFor="materials-notes" className="block text-sm font-medium text-gray-400 mb-2">
          Malzeme Notları
        </label>
        <textarea
          id="materials-notes"
          name="materials-notes"
          placeholder="Malzeme tedariki, kalite standartları, özel şartlar hakkında notlarınızı buraya yazabilirsiniz..."
          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-colors resize-none"
          rows={3}
        />
      </div>
    </div>
  );
}
