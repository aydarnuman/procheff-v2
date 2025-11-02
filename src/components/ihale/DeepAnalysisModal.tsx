"use client";

import { motion } from "framer-motion";
import {
  XCircle,
  Target,
  CheckCircle,
  Award,
  TrendingUp,
  CheckCircle2,
  Shield,
  AlertTriangle,
  DollarSign,
  Users,
  Clock,
  FileText,
  FilePlus,
} from "lucide-react";

interface DeepAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  deepAnalysisData: any;
  loading: boolean;
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <div className="bg-white/5 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold">{title}</h3>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function DeepAnalysisModal({
  isOpen,
  onClose,
  deepAnalysisData,
  loading,
}: DeepAnalysisModalProps) {
  if (!isOpen) return null;

  const kararColor =
    deepAnalysisData?.karar_onerisi?.tavsiye === "KATIL"
      ? "bg-green-500/10 border-green-500/30 text-green-400"
      : deepAnalysisData?.karar_onerisi?.tavsiye === "DİKKATLİ_KATIL"
      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
      : "bg-red-500/10 border-red-500/30 text-red-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold">Derin Stratejik Analiz</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mb-4"
              />
              <p className="text-gray-400">Derin analiz yapılıyor...</p>
              <p className="text-sm text-gray-500 mt-2">Bu işlem 20-40 saniye sürebilir</p>
            </div>
          ) : deepAnalysisData ? (
            <>
              {/* Karar Önerisi - En Üstte */}
              <div className={`p-6 rounded-lg border ${kararColor}`}>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6" />
                  Karar Önerisi: {deepAnalysisData.karar_onerisi.tavsiye}
                </h3>
                <p className="text-sm opacity-90 mb-4">{deepAnalysisData.karar_onerisi.gerekce}</p>
                <div className="flex items-center gap-2 text-xs">
                  <Award className="w-4 h-4" />
                  <span>Güven Skoru: {Math.round(deepAnalysisData.guven_skoru * 100)}%</span>
                </div>
              </div>

              {/* Fırsat Analizi */}
              <Section title="Fırsat Analizi" icon={<TrendingUp className="w-5 h-5" />}>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Avantajlar:</h4>
                    <ul className="space-y-2">
                      {deepAnalysisData.firsat_analizi.avantajlar.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Rekabet Güçlü Yönler:</h4>
                    <ul className="space-y-2">
                      {deepAnalysisData.firsat_analizi.rekabet_guclu_yonler.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Shield className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Kazanma Faktörleri:</h4>
                    <ul className="space-y-2">
                      {deepAnalysisData.firsat_analizi.kazanma_faktörleri.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Target className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-400 mb-2">Uzun Vade Potansiyel:</h4>
                    <p className="text-sm">{deepAnalysisData.firsat_analizi.uzun_vade_potansiyel}</p>
                  </div>
                </div>
              </Section>

              {/* Detaylı Risk Analizi */}
              <Section title="Detaylı Risk Analizi" icon={<AlertTriangle className="w-5 h-5" />}>
                <div className="space-y-4">
                  {deepAnalysisData.detayli_risk_analizi.kritik_riskler.map((risk: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border ${
                        risk.etki === "kritik"
                          ? "bg-red-500/10 border-red-500/30"
                          : risk.etki === "yüksek"
                          ? "bg-orange-500/10 border-orange-500/30"
                          : risk.etki === "orta"
                          ? "bg-yellow-500/10 border-yellow-500/30"
                          : "bg-green-500/10 border-green-500/30"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{risk.risk}</h4>
                        <div className="flex gap-2 text-xs">
                          <span className="px-2 py-1 bg-white/10 rounded">
                            Olasılık: {risk.olasilik}
                          </span>
                          <span className="px-2 py-1 bg-white/10 rounded">
                            Etki: {risk.etki}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-300">
                        <span className="font-semibold">Önlem:</span> {risk.onlem}
                      </p>
                    </div>
                  ))}

                  {deepAnalysisData.detayli_risk_analizi.kirmizi_bayraklar?.length > 0 && (
                    <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                      <h4 className="text-sm font-semibold text-red-400 mb-2">⚠️ Kırmızı Bayraklar:</h4>
                      <ul className="space-y-1">
                        {deepAnalysisData.detayli_risk_analizi.kirmizi_bayraklar.map((item: string, idx: number) => (
                          <li key={idx} className="text-sm text-red-300">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Section>

              {/* Maliyet Stratejisi */}
              <Section title="Maliyet Stratejisi" icon={<DollarSign className="w-5 h-5" />}>
                <div className="space-y-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <h4 className="text-sm font-semibold text-green-400 mb-2">Fiyatlandırma Önerisi:</h4>
                    <p className="text-sm">{deepAnalysisData.maliyet_stratejisi.fiyatlandirma_onerisi}</p>
                  </div>

                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <h4 className="text-sm font-semibold text-yellow-400 mb-2">Kar Marjı Hedef:</h4>
                    <p className="text-sm">{deepAnalysisData.maliyet_stratejisi.kar_marji_hedef}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Optimizasyon Noktaları:</h4>
                    <ul className="space-y-1">
                      {deepAnalysisData.maliyet_stratejisi.optimizasyon_noktalari.map((item: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-300">• {item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Gizli Maliyetler:</h4>
                    <ul className="space-y-1">
                      {deepAnalysisData.maliyet_stratejisi.gizli_maliyetler.map((item: string, idx: number) => (
                        <li key={idx} className="text-sm text-orange-300">⚠️ {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Section>

              {/* Operasyonel Plan */}
              <Section title="Operasyonel Plan" icon={<Users className="w-5 h-5" />}>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                      <h4 className="text-xs text-gray-400 mb-1">İnsan Gücü</h4>
                      <p className="text-sm">{deepAnalysisData.operasyonel_plan.kaynak_ihtiyaclari.insan_gucu}</p>
                    </div>
                    <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                      <h4 className="text-xs text-gray-400 mb-1">Ekipman</h4>
                      <p className="text-sm">{deepAnalysisData.operasyonel_plan.kaynak_ihtiyaclari.ekipman}</p>
                    </div>
                    <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                      <h4 className="text-xs text-gray-400 mb-1">Lojistik</h4>
                      <p className="text-sm">{deepAnalysisData.operasyonel_plan.kaynak_ihtiyaclari.lojistik}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Kritik Tarihler:</h4>
                    <ul className="space-y-1">
                      {deepAnalysisData.operasyonel_plan.kritik_tarihler.map((item: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                          <Clock className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg">
                    <h4 className="text-sm font-semibold mb-2">Tedarik Zinciri:</h4>
                    <p className="text-sm text-gray-300">{deepAnalysisData.operasyonel_plan.tedarik_zinciri}</p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg">
                    <h4 className="text-sm font-semibold mb-2">Kalite Kontrol:</h4>
                    <p className="text-sm text-gray-300">{deepAnalysisData.operasyonel_plan.kalite_kontrol}</p>
                  </div>
                </div>
              </Section>

              {/* Teklif Stratejisi */}
              <Section title="Teklif Stratejisi" icon={<FileText className="w-5 h-5" />}>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Güçlü Yönler:</h4>
                    <ul className="space-y-1">
                      {deepAnalysisData.teklif_stratejisi.guclu_yonler.map((item: string, idx: number) => (
                        <li key={idx} className="text-sm text-green-300">✓ {item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Dikkat Noktaları:</h4>
                    <ul className="space-y-1">
                      {deepAnalysisData.teklif_stratejisi.dikkat_noktalari.map((item: string, idx: number) => (
                        <li key={idx} className="text-sm text-yellow-300">⚠️ {item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-400 mb-2">Referans Stratejisi:</h4>
                    <p className="text-sm">{deepAnalysisData.teklif_stratejisi.referans_stratejisi}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Öne Çıkan Noktalar:</h4>
                    <ul className="space-y-1">
                      {deepAnalysisData.teklif_stratejisi.one_cikan_noktalar.map((item: string, idx: number) => (
                        <li key={idx} className="text-sm text-purple-300">★ {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Section>

              {/* Başarı Kriterleri & Alternatif Senaryolar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Section title="Başarı Kriterleri" icon={<Target className="w-5 h-5" />}>
                  <ul className="space-y-2">
                    {deepAnalysisData.karar_onerisi.basari_kriterleri.map((item: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Section>

                <Section title="Alternatif Senaryolar" icon={<FilePlus className="w-5 h-5" />}>
                  <ul className="space-y-2">
                    {deepAnalysisData.karar_onerisi.alternatif_senaryolar.map((item: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-300">
                        <span className="font-semibold text-blue-400">#{idx + 1}</span> {item}
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Derin analiz verisi bulunamadı</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && deepAnalysisData && (
          <div className="p-4 border-t border-white/10 flex items-center justify-between bg-white/5">
            <div className="text-sm text-gray-400">
              <Clock className="w-4 h-4 inline mr-1" />
              Analiz Zamanı: {new Date().toLocaleString('tr-TR')}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-medium"
            >
              Kapat
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
