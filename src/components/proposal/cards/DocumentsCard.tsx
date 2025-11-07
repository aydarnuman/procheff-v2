"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, FileCheck } from "lucide-react";
import { AIAnalysisResult } from "@/types/ai";

interface DocumentsCardProps {
  data: any;
  analysis: AIAnalysisResult;
  onChange: (data: any) => void;
}

interface Document {
  id: string;
  name: string;
  checked: boolean;
  category: "zorunlu" | "opsiyonel";
}

export function DocumentsCard({ data, analysis, onChange }: DocumentsCardProps) {
  const [localData, setLocalData] = useState<Document[]>(
    data.length > 0
      ? data
      : [
          // Zorunlu Belgeler
          { id: "1", name: "İmza Beyannamesi ve İmza Sirküleri", checked: false, category: "zorunlu" },
          { id: "2", name: "Teklif Mektubu", checked: false, category: "zorunlu" },
          { id: "3", name: "İş Deneyim Belgesi", checked: false, category: "zorunlu" },
          { id: "4", name: "SGK Tescil Belgesi", checked: false, category: "zorunlu" },
          { id: "5", name: "Vergi Levhası", checked: false, category: "zorunlu" },
          { id: "6", name: "Ticaret Sicil Gazetesi", checked: false, category: "zorunlu" },
          { id: "7", name: "ISO 22000 Belgesi", checked: false, category: "zorunlu" },
          { id: "8", name: "Sağlık Belgesi (Personel)", checked: false, category: "zorunlu" },
          { id: "9", name: "Geçici Teminat Mektubu", checked: false, category: "zorunlu" },
          { id: "10", name: "Şartname Eki Belgeler", checked: false, category: "zorunlu" },
          // Opsiyonel Belgeler
          { id: "11", name: "ISO 9001 Belgesi", checked: false, category: "opsiyonel" },
          { id: "12", name: "HACCP Belgesi", checked: false, category: "opsiyonel" },
          { id: "13", name: "Marka Patent Belgeleri", checked: false, category: "opsiyonel" },
          { id: "14", name: "Kalite Sertifikaları", checked: false, category: "opsiyonel" },
          { id: "15", name: "Referans Mektupları", checked: false, category: "opsiyonel" },
        ]
  );

  // Parent'a değişiklikleri ilet
  useEffect(() => {
    onChange(localData);
  }, [localData]);

  const handleToggle = (id: string) => {
    setLocalData(
      localData.map((doc) =>
        doc.id === id ? { ...doc, checked: !doc.checked } : doc
      )
    );
  };

  const zorunluDocs = localData.filter((d) => d.category === "zorunlu");
  const opsiyonelDocs = localData.filter((d) => d.category === "opsiyonel");

  const zorunluChecked = zorunluDocs.filter((d) => d.checked).length;
  const opsiyonelChecked = opsiyonelDocs.filter((d) => d.checked).length;
  const totalChecked = localData.filter((d) => d.checked).length;
  const completionRate = Math.round((totalChecked / localData.length) * 100);

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white">Gerekli Belgeler</h3>
          <p className="text-gray-400 mt-1">
            İhale için hazırlanması gereken belge listesi
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-purple-400">{completionRate}%</p>
          <p className="text-xs text-gray-500">Tamamlanma</p>
        </div>
      </div>

      {/* İlerleme Çubuğu */}
      <div className="relative">
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{totalChecked} / {localData.length} belge hazır</span>
          <span>Zorunlu: {zorunluChecked}/{zorunluDocs.length}</span>
        </div>
      </div>

      {/* AI Öneri Kutusu */}
      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <FileCheck className="w-5 h-5 text-purple-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-purple-300 font-medium">AI Önerisi</p>
            <p className="text-xs text-gray-400 mt-1">
              {analysis?.extracted_data?.ozel_sartlar?.length > 0
                ? `İhale şartnamesinde ${analysis.extracted_data.ozel_sartlar.length} özel şart tespit edildi. Zorunlu belgeleri eksiksiz tamamladığınızdan emin olun.`
                : "Genel ihale belgelerini listeledik. Zorunlu belgeleri öncelikli olarak hazırlayın."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Zorunlu Belgeler */}
        <div className="bg-gradient-to-br from-red-500/5 to-orange-500/5 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <h4 className="text-lg font-semibold text-white">
              Zorunlu Belgeler
            </h4>
            <span className="ml-auto text-sm text-red-400 font-medium">
              {zorunluChecked}/{zorunluDocs.length}
            </span>
          </div>
          <div className="space-y-2">
            {zorunluDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleToggle(doc.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                  doc.checked
                    ? "bg-green-500/20 border border-green-500/40"
                    : "bg-gray-800/50 border border-gray-700 hover:border-gray-600"
                }`}
              >
                {doc.checked ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-500 flex-shrink-0" />
                )}
                <span
                  className={`text-sm text-left flex-1 ${
                    doc.checked
                      ? "text-white font-medium"
                      : "text-gray-300"
                  }`}
                >
                  {doc.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Opsiyonel Belgeler */}
        <div className="bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <h4 className="text-lg font-semibold text-white">
              Opsiyonel Belgeler
            </h4>
            <span className="ml-auto text-sm text-blue-400 font-medium">
              {opsiyonelChecked}/{opsiyonelDocs.length}
            </span>
          </div>
          <div className="space-y-2">
            {opsiyonelDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleToggle(doc.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                  doc.checked
                    ? "bg-green-500/20 border border-green-500/40"
                    : "bg-gray-800/50 border border-gray-700 hover:border-gray-600"
                }`}
              >
                {doc.checked ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-500 flex-shrink-0" />
                )}
                <span
                  className={`text-sm text-left flex-1 ${
                    doc.checked
                      ? "text-white font-medium"
                      : "text-gray-300"
                  }`}
                >
                  {doc.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-gradient-to-br from-green-600/10 to-green-600/5 border border-green-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Tamamlanan</p>
          <p className="text-2xl font-bold text-green-400">{totalChecked}</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-orange-600/10 to-orange-600/5 border border-orange-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Zorunlu Kalan</p>
          <p className="text-2xl font-bold text-orange-400">
            {zorunluDocs.length - zorunluChecked}
          </p>
        </div>
        <div className="p-4 bg-gradient-to-br from-purple-600/10 to-purple-600/5 border border-purple-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Tamamlanma</p>
          <p className="text-2xl font-bold text-purple-400">{completionRate}%</p>
        </div>
      </div>

      {/* Notlar */}
      <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
        <label htmlFor="documents-notes" className="block text-sm font-medium text-gray-400 mb-2">
          Belge Hazırlama Notları
        </label>
        <textarea
          id="documents-notes"
          name="documents-notes"
          placeholder="Belgelerle ilgili notlarınızı, eksik olanları veya özel durumları buraya yazabilirsiniz..."
          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-colors resize-none"
          rows={3}
        />
      </div>
    </div>
  );
}
