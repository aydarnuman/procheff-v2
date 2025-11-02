"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Calculator } from "lucide-react";
import { AIAnalysisResult } from "@/types/ai";

interface PersonnelCardProps {
  data: any;
  analysis: AIAnalysisResult;
  onChange: (data: any) => void;
}

interface PersonnelRow {
  id: string;
  position: string;
  count: number;
  salary: number;
  workDays: number;
}

export function PersonnelCard({ data, analysis, onChange }: PersonnelCardProps) {
  const [localData, setLocalData] = useState<PersonnelRow[]>(
    data.length > 0
      ? data
      : [
          { id: "1", position: "Aşçıbaşı", count: 1, salary: 25000, workDays: 365 },
          { id: "2", position: "Aşçı", count: 3, salary: 18000, workDays: 365 },
          { id: "3", position: "Aşçı Yardımcısı", count: 4, salary: 15000, workDays: 365 },
          { id: "4", position: "Bulaşıkçı", count: 2, salary: 13000, workDays: 365 },
        ]
  );

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("tr-TR").format(num);
  };

  // Toplam maliyet hesaplama
  const calculateTotal = () => {
    return localData.reduce((sum, row) => {
      const monthlyTotal = row.count * row.salary * (row.workDays / 30);
      return sum + monthlyTotal;
    }, 0);
  };

  const yearlyTotal = calculateTotal();

  // Parent'a değişiklikleri ilet
  useEffect(() => {
    onChange(localData);
  }, [localData]);

  const handleAdd = () => {
    const newRow: PersonnelRow = {
      id: Date.now().toString(),
      position: "Yeni Pozisyon",
      count: 1,
      salary: 15000,
      workDays: 365,
    };
    setLocalData([...localData, newRow]);
  };

  const handleDelete = (id: string) => {
    setLocalData(localData.filter((row) => row.id !== id));
  };

  const handleChange = (id: string, field: keyof PersonnelRow, value: any) => {
    setLocalData(
      localData.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-6 py-4 border-b-2 border-blue-500/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Calculator className="text-blue-400" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Personel Planlaması</h3>
              <p className="text-sm text-gray-400">
                İhale için gerekli personel ve maliyet hesaplaması
              </p>
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Pozisyon Ekle</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">

      {/* AI Öneri Kutusu */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Calculator className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-blue-300 font-medium">AI Önerisi</p>
            <p className="text-xs text-gray-400 mt-1">
              {analysis?.extracted_data?.kisi_sayisi
                ? `${formatNumber(
                    analysis.extracted_data.kisi_sayisi
                  )} kişilik yemek servisi için önerilen personel kadrosu. Pozisyon sayılarını ihtiyacınıza göre düzenleyebilirsiniz.`
                : "İhale dökümanından personel bilgisi çıkarılamadı. Aşağıdaki tabloyu ihtiyaçlarınıza göre düzenleyin."}
            </p>
          </div>
        </div>
      </div>

      {/* Personel Tablosu */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-b border-gray-700">
              <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                Pozisyon
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                Kişi Sayısı
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                Aylık Maaş
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                Çalışma Günü
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-white">
                Yıllık Maliyet
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                İşlem
              </th>
            </tr>
          </thead>
          <tbody>
            {localData.map((row, index) => {
              const rowTotal = row.count * row.salary * (row.workDays / 30);
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
                      value={row.position}
                      onChange={(e) =>
                        handleChange(row.id, "position", e.target.value)
                      }
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                      placeholder="Pozisyon adı"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={row.count}
                      onChange={(e) =>
                        handleChange(
                          row.id,
                          "count",
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-24 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                      min="1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={row.salary}
                      onChange={(e) =>
                        handleChange(
                          row.id,
                          "salary",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-32 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                      step="100"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={row.workDays}
                      onChange={(e) =>
                        handleChange(
                          row.id,
                          "workDays",
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-24 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                      min="1"
                      max="365"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-green-400 font-semibold">
                      {formatCurrency(rowTotal)}
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
                colSpan={4}
                className="px-4 py-4 text-right text-white font-bold text-lg"
              >
                TOPLAM YILLIK PERSONEL MALİYETİ
              </td>
              <td className="px-4 py-4 text-right">
                <span className="text-green-400 font-bold text-xl">
                  {formatCurrency(yearlyTotal)}
                </span>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="p-4 bg-gradient-to-br from-blue-600/10 to-blue-600/5 border border-blue-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Toplam Personel</p>
          <p className="text-2xl font-bold text-blue-400">
            {localData.reduce((sum, row) => sum + row.count, 0)} Kişi
          </p>
        </div>
        <div className="p-4 bg-gradient-to-br from-purple-600/10 to-purple-600/5 border border-purple-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Aylık Ortalama</p>
          <p className="text-2xl font-bold text-purple-400">
            {formatCurrency(yearlyTotal / 12)}
          </p>
        </div>
        <div className="p-4 bg-gradient-to-br from-orange-600/10 to-orange-600/5 border border-orange-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Pozisyon Sayısı</p>
          <p className="text-2xl font-bold text-orange-400">
            {localData.length} Farklı
          </p>
        </div>
      </div>

      {/* Notlar */}
      <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Personel Planlaması Notları
        </label>
        <textarea
          placeholder="Personel planlaması ile ilgili ekstra notlarınızı buraya yazabilirsiniz..."
          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
          rows={3}
        />
      </div>
      </div>
    </div>
  );
}
