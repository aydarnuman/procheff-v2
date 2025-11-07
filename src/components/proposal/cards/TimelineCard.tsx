"use client";

import { useState } from "react";
import { Calendar, Clock, AlertCircle } from "lucide-react";

interface TimelineCardProps {
  data: {
    contractStartDate?: string;
    contractEndDate?: string;
    contractDuration?: number;
    preparationDays?: number;
    mobilizationDays?: number;
    demobilizationDays?: number;
    notes?: string;
  };
  onChange: (data: any) => void;
  contractDays?: number;
}

export function TimelineCard({ data, onChange, contractDays = 365 }: TimelineCardProps) {
  const [formData, setFormData] = useState({
    contractStartDate: data?.contractStartDate || "",
    contractEndDate: data?.contractEndDate || "",
    contractDuration: data?.contractDuration || contractDays,
    preparationDays: data?.preparationDays || 15,
    mobilizationDays: data?.mobilizationDays || 7,
    demobilizationDays: data?.demobilizationDays || 7,
    notes: data?.notes || "",
  });

  const handleChange = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };

    // Başlangıç tarihi değiştiyse, bitiş tarihini otomatik hesapla
    if (field === "contractStartDate" && value) {
      const startDate = new Date(value);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + updated.contractDuration);
      updated.contractEndDate = endDate.toISOString().split("T")[0];
    }

    // Süre değiştiyse, bitiş tarihini güncelle
    if (field === "contractDuration" && updated.contractStartDate) {
      const startDate = new Date(updated.contractStartDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + parseInt(value));
      updated.contractEndDate = endDate.toISOString().split("T")[0];
    }

    setFormData(updated);
    onChange(updated);
  };

  const totalDays =
    formData.preparationDays +
    formData.contractDuration +
    formData.demobilizationDays;

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 px-6 py-4 border-b-2 border-orange-500/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Calendar className="text-orange-400" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Zaman Çizelgesi</h3>
              <p className="text-sm text-gray-400">
                İhale süreci ve proje takvimi
              </p>
            </div>
          </div>
          <div className="bg-blue-500/20 border border-blue-500/40 rounded-lg px-3 py-2">
            <p className="text-xs text-blue-300 font-medium">
              Sözleşme: <strong>{contractDays} gün</strong>
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

      {/* Contract Dates */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Sözleşme Tarihleri</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={formData.contractStartDate}
              onChange={(e) => handleChange("contractStartDate", e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Bitiş Tarihi</label>
            <input
              type="date"
              value={formData.contractEndDate}
              onChange={(e) => handleChange("contractEndDate", e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Sözleşme Süresi (gün)
          </label>
          <input
            type="number"
            value={formData.contractDuration}
            onChange={(e) =>
              handleChange("contractDuration", parseInt(e.target.value) || 0)
            }
            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:outline-none"
            placeholder={contractDays.toString()}
            min="1"
          />
        </div>
      </div>

      {/* Phase Durations */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Faz Süreleri</h4>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Hazırlık Süresi (gün)
            </label>
            <input
              type="number"
              value={formData.preparationDays}
              onChange={(e) =>
                handleChange("preparationDays", parseInt(e.target.value) || 0)
              }
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:outline-none"
              placeholder="15"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              Malzeme tedariki, personel istihdamı, ekipman kurulumu
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Mobilizasyon Süresi (gün)
            </label>
            <input
              type="number"
              value={formData.mobilizationDays}
              onChange={(e) =>
                handleChange("mobilizationDays", parseInt(e.target.value) || 0)
              }
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:outline-none"
              placeholder="7"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sahada kurulum ve ilk operasyonların başlatılması
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Demobilizasyon Süresi (gün)
            </label>
            <input
              type="number"
              value={formData.demobilizationDays}
              onChange={(e) =>
                handleChange("demobilizationDays", parseInt(e.target.value) || 0)
              }
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:outline-none"
              placeholder="7"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              Operasyonların kapatılması ve ekipman kaldırılması
            </p>
          </div>
        </div>
      </div>

      {/* Timeline Summary */}
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-orange-400" />
          <h4 className="text-white font-semibold">Toplam Süre Özeti</h4>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-orange-500/20">
            <span className="text-gray-400">Hazırlık:</span>
            <span className="text-white font-medium">{formData.preparationDays} gün</span>
          </div>
          <div className="flex justify-between py-2 border-b border-orange-500/20">
            <span className="text-gray-400">Mobilizasyon:</span>
            <span className="text-white font-medium">{formData.mobilizationDays} gün</span>
          </div>
          <div className="flex justify-between py-2 border-b border-orange-500/20">
            <span className="text-gray-400">Sözleşme Süresi:</span>
            <span className="text-orange-400 font-semibold">{formData.contractDuration} gün</span>
          </div>
          <div className="flex justify-between py-2 border-b border-orange-500/20">
            <span className="text-gray-400">Demobilizasyon:</span>
            <span className="text-white font-medium">{formData.demobilizationDays} gün</span>
          </div>
          <div className="flex justify-between pt-3">
            <span className="text-gray-300 font-semibold text-base">TOPLAM:</span>
            <span className="text-orange-400 font-bold text-lg">{totalDays} gün</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="timeline-notes" className="block text-sm text-gray-400 mb-2">Ek Notlar</label>
        <textarea
          id="timeline-notes"
          name="timeline-notes"
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:outline-none resize-none"
          placeholder="Zaman çizelgesi ile ilgili özel durumlar, kritik tarihler..."
          rows={3}
        />
      </div>
      </div>
    </div>
  );
}
