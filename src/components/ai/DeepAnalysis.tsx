"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Target,
  AlertTriangle,
  DollarSign,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";
import { AIAnalysisResult, DeepAnalysisResult } from "@/types/ai";

interface DeepAnalysisProps {
  analysis: AIAnalysisResult;
  cachedResult: DeepAnalysisResult | null;
  onAnalysisComplete: (result: DeepAnalysisResult) => void;
}

export function DeepAnalysis({ analysis, cachedResult, onAnalysisComplete }: DeepAnalysisProps) {
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysisResult | null>(cachedResult);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  const handleDeepAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    setProgressMessage("Claude Opus'a bağlanılıyor...");

    try {
      // AKILLI FAKE PROGRESS - Derin analiz ~40-60 saniye sürüyor
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          // %95'e kadar yavaşça artır
          if (prev < 95) {
            // İlk 25 saniye hızlı (%60'a kadar)
            if (prev < 60) {
              currentProgress += 2; // Her 500ms'de +2
            } else if (prev < 85) {
              // 25-45. saniye orta hız (%85'e kadar)
              currentProgress += 1;
            } else {
              // Son 15 saniye yavaş (%95'e kadar)
              currentProgress += 0.3;
            }
            return Math.min(currentProgress, 95);
          }
          return prev;
        });

        // Progress seviyesine göre GERÇEK mesajları göster
        setProgressMessage(() => {
          const p = currentProgress;
          if (p < 15) return "Şartname detayları Claude Opus'a gönderiliyor...";
          if (p < 30) return "Fırsat analizi yapılıyor (rekabet avantajları)...";
          if (p < 45) return "Detaylı risk matrisi oluşturuluyor...";
          if (p < 60) return "Maliyet stratejisi hesaplanıyor (kar marjı, fiyatlandırma)...";
          if (p < 75) return "Alternatif senaryolar değerlendiriliyor...";
          if (p < 90) return "Karar önerisi hazırlanıyor...";
          return "Tamamlanıyor...";
        });
      }, 500);

      const response = await fetch("/api/ai/deep-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extracted_data: analysis.extracted_data,
          contextual_analysis: analysis.contextual_analysis,
        }),
      });

      // Interval'i durdur
      clearInterval(progressInterval);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Derin analiz başarısız");
      }

      setProgress(100);
      setProgressMessage("✅ Derin analiz tamamlandı!");
      await new Promise(resolve => setTimeout(resolve, 500));

      setDeepAnalysis(result.data);
      onAnalysisComplete(result.data); // Cache'e kaydet
    } catch (err: any) {
      console.error("Deep analysis error:", err);
      setError(err.message || "Derin analiz sırasında hata oluştu");
    } finally {
      setIsLoading(false);
      setProgress(0);
      setProgressMessage("");
    }
  };

  const getDecisionColor = (tavsiye: string) => {
    switch (tavsiye) {
      case "KATIL":
        return "text-green-400 bg-green-500/10 border-green-500/30";
      case "DİKKATLİ_KATIL":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "KATILMA":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/30";
    }
  };

  const getDecisionIcon = (tavsiye: string) => {
    switch (tavsiye) {
      case "KATIL":
        return <CheckCircle className="w-6 h-6" />;
      case "DİKKATLİ_KATIL":
        return <AlertCircle className="w-6 h-6" />;
      case "KATILMA":
        return <XCircle className="w-6 h-6" />;
      default:
        return <AlertTriangle className="w-6 h-6" />;
    }
  };

  const getRiskColor = (etki: string) => {
    switch (etki) {
      case "kritik":
        return "text-red-400 bg-red-500/10";
      case "yüksek":
        return "text-orange-400 bg-orange-500/10";
      case "orta":
        return "text-yellow-400 bg-yellow-500/10";
      case "düşük":
        return "text-green-400 bg-green-500/10";
      default:
        return "text-gray-400 bg-gray-500/10";
    }
  };

  if (!deepAnalysis) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-2xl w-full"
        >
          {!isLoading ? (
            <>
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="w-10 h-10 text-white" />
              </div>

              <h3 className="text-2xl font-bold text-surface-primary mb-3">
                Derin Analiz
              </h3>
              <p className="text-surface-secondary mb-8 leading-relaxed">
                <strong className="text-purple-400">Claude Opus</strong> kullanarak bu ihale için
                <strong className="text-white"> detaylı strateji</strong> ve{" "}
                <strong className="text-white">karar önerisi</strong> oluşturun.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-left">
                <div className="p-4 bg-platinum-800/40 rounded-lg border border-platinum-700/30">
                  <Target className="w-5 h-5 text-blue-400 mb-2" />
                  <p className="text-sm font-medium text-surface-primary mb-1">Fırsat Analizi</p>
                  <p className="text-xs text-surface-secondary">Rekabet avantajları ve kazanma faktörleri</p>
                </div>
                <div className="p-4 bg-platinum-800/40 rounded-lg border border-platinum-700/30">
                  <Shield className="w-5 h-5 text-red-400 mb-2" />
                  <p className="text-sm font-medium text-surface-primary mb-1">Detaylı Risk Analizi</p>
                  <p className="text-xs text-surface-secondary">Kritik riskler ve azaltma stratejileri</p>
                </div>
                <div className="p-4 bg-platinum-800/40 rounded-lg border border-platinum-700/30">
                  <DollarSign className="w-5 h-5 text-green-400 mb-2" />
                  <p className="text-sm font-medium text-surface-primary mb-1">Maliyet Stratejisi</p>
                  <p className="text-xs text-surface-secondary">Fiyatlandırma ve kar marjı optimizasyonu</p>
                </div>
                <div className="p-4 bg-platinum-800/40 rounded-lg border border-platinum-700/30">
                  <Zap className="w-5 h-5 text-yellow-400 mb-2" />
                  <p className="text-sm font-medium text-surface-primary mb-1">Karar Önerisi</p>
                  <p className="text-xs text-surface-secondary">Uzman görüş ve alternatif senaryolar</p>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleDeepAnalysis}
                disabled={isLoading}
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-purple-500/50 disabled:to-pink-500/50 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
              >
                <TrendingUp className="w-5 h-5" />
                <span>Derin Analizi Başlat</span>
              </button>
            </>
          ) : (
            <>
              {/* Loading state with progress bar */}
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <TrendingUp className="w-10 h-10 text-white" />
              </div>

              <h3 className="text-2xl font-bold text-surface-primary mb-3">
                Derin Analiz Yapılıyor
              </h3>
              <p className="text-surface-secondary mb-8">
                Claude Opus şartnameyi detaylı analiz ediyor...
              </p>

              {/* Progress Bar */}
              <div className="mb-6 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium text-surface-primary">{progressMessage}</span>
                  </div>
                  <span className="text-sm font-semibold text-purple-400">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full bg-platinum-800/60 rounded-full h-3">
                  <motion.div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Analysis Steps */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-left">
                {[
                  { label: "Fırsat Analizi", active: progress >= 15 },
                  { label: "Risk Matrisi", active: progress >= 45 },
                  { label: "Maliyet Stratejisi", active: progress >= 60 },
                  { label: "Senaryolar", active: progress >= 75 },
                  { label: "Karar Önerisi", active: progress >= 90 },
                ].map((step, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border transition-all duration-500 ${
                      step.active
                        ? "bg-purple-500/20 border-purple-500/30 text-purple-300"
                        : "bg-platinum-800/40 border-platinum-700/40 text-platinum-400"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      {step.active ? (
                        <CheckCircle className="w-4 h-4 text-purple-400" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-platinum-600 rounded-full" />
                      )}
                      <span className="text-xs font-medium">{step.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>
    );
  }


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Karar Önerisi - Başta */}
      <div className={`rounded-xl p-6 border-2 ${getDecisionColor(deepAnalysis.karar_onerisi.tavsiye)}`}>
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            {getDecisionIcon(deepAnalysis.karar_onerisi.tavsiye)}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2">
              {deepAnalysis.karar_onerisi.tavsiye.replace("_", " ")}
            </h3>
            <p className="text-sm leading-relaxed opacity-90 whitespace-pre-line">
              {deepAnalysis.karar_onerisi.gerekce}
            </p>
          </div>
        </div>
      </div>

      {/* Fırsat Analizi */}
      <div className="bg-platinum-800/60 rounded-xl p-6 backdrop-blur-sm border border-platinum-700/30">
        <div className="flex items-center space-x-3 mb-4">
          <Target className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-surface-primary">Fırsat Analizi</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-surface-secondary mb-2">Avantajlar</h4>
            <ul className="space-y-1">
              {deepAnalysis.firsat_analizi.avantajlar.map((item, idx) => (
                <li key={idx} className="text-sm text-surface-primary flex items-start space-x-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium text-surface-secondary mb-2">Güçlü Yönler</h4>
            <ul className="space-y-1">
              {deepAnalysis.firsat_analizi.rekabet_guclu_yonler.map((item, idx) => (
                <li key={idx} className="text-sm text-surface-primary flex items-start space-x-2">
                  <span className="text-blue-400 mt-0.5">★</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 p-3 bg-platinum-900/40 rounded-lg">
          <p className="text-xs text-surface-secondary mb-1">Uzun Vade Potansiyeli:</p>
          <p className="text-sm text-surface-primary">{deepAnalysis.firsat_analizi.uzun_vade_potansiyel}</p>
        </div>
      </div>

      {/* Risk Analizi */}
      <div className="bg-platinum-800/60 rounded-xl p-6 backdrop-blur-sm border border-platinum-700/30">
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <h3 className="text-lg font-semibold text-surface-primary">Detaylı Risk Analizi</h3>
        </div>

        <div className="space-y-3 mb-4">
          {deepAnalysis.detayli_risk_analizi.kritik_riskler.map((risk, idx) => (
            <div key={idx} className="p-4 bg-platinum-900/40 rounded-lg border border-platinum-700/20">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-surface-primary flex-1">{risk.risk}</h4>
                <span className={`text-xs px-2 py-1 rounded ${getRiskColor(risk.etki)}`}>
                  {risk.etki}
                </span>
              </div>
              <p className="text-xs text-surface-secondary mb-2">
                <span className="font-medium">Olasılık:</span> {risk.olasilik}
              </p>
              <p className="text-xs text-green-400">
                <span className="font-medium">Önlem:</span> {risk.onlem}
              </p>
            </div>
          ))}
        </div>

        {deepAnalysis.detayli_risk_analizi.kirmizi_bayraklar.length > 0 && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm font-medium text-red-400 mb-2">⚠️ Kırmızı Bayraklar:</p>
            <ul className="space-y-1">
              {deepAnalysis.detayli_risk_analizi.kirmizi_bayraklar.map((item, idx) => (
                <li key={idx} className="text-xs text-red-300">• {item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Maliyet Stratejisi */}
      <div className="bg-platinum-800/60 rounded-xl p-6 backdrop-blur-sm border border-platinum-700/30">
        <div className="flex items-center space-x-3 mb-4">
          <DollarSign className="w-6 h-6 text-green-400" />
          <h3 className="text-lg font-semibold text-surface-primary">Maliyet Stratejisi</h3>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm font-medium text-green-400 mb-1">Fiyatlandırma Önerisi</p>
            <p className="text-sm text-surface-primary">{deepAnalysis.maliyet_stratejisi.fiyatlandirma_onerisi}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-surface-secondary mb-2">Optimizasyon Noktaları:</p>
              <ul className="space-y-1">
                {deepAnalysis.maliyet_stratejisi.optimizasyon_noktalari.map((item, idx) => (
                  <li key={idx} className="text-xs text-surface-primary">• {item}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs text-surface-secondary mb-2">Gizli Maliyetler:</p>
              <ul className="space-y-1">
                {deepAnalysis.maliyet_stratejisi.gizli_maliyetler.map((item, idx) => (
                  <li key={idx} className="text-xs text-orange-300">⚠ {item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-3 bg-platinum-900/40 rounded-lg">
            <p className="text-xs text-surface-secondary mb-1">Kar Marjı Hedefi:</p>
            <p className="text-sm text-green-400 font-medium">{deepAnalysis.maliyet_stratejisi.kar_marji_hedef}</p>
          </div>
        </div>
      </div>

      {/* Operasyonel Plan & Teklif Stratejisi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-platinum-800/60 rounded-xl p-6 backdrop-blur-sm border border-platinum-700/30">
          <div className="flex items-center space-x-3 mb-4">
            <Users className="w-6 h-6 text-purple-400" />
            <h3 className="text-lg font-semibold text-surface-primary">Operasyonel Plan</h3>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-surface-secondary mb-1">İnsan Gücü:</p>
              <p className="text-sm text-surface-primary">{deepAnalysis.operasyonel_plan.kaynak_ihtiyaclari.insan_gucu}</p>
            </div>
            <div>
              <p className="text-xs text-surface-secondary mb-1">Ekipman:</p>
              <p className="text-sm text-surface-primary">{deepAnalysis.operasyonel_plan.kaynak_ihtiyaclari.ekipman}</p>
            </div>
            <div>
              <p className="text-xs text-surface-secondary mb-1">Lojistik:</p>
              <p className="text-sm text-surface-primary">{deepAnalysis.operasyonel_plan.kaynak_ihtiyaclari.lojistik}</p>
            </div>
          </div>
        </div>

        <div className="bg-platinum-800/60 rounded-xl p-6 backdrop-blur-sm border border-platinum-700/30">
          <div className="flex items-center space-x-3 mb-4">
            <FileText className="w-6 h-6 text-orange-400" />
            <h3 className="text-lg font-semibold text-surface-primary">Teklif Stratejisi</h3>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-surface-secondary mb-1">Vurgulayın:</p>
              {deepAnalysis.teklif_stratejisi.guclu_yonler.map((item, idx) => (
                <p key={idx} className="text-xs text-green-400">✓ {item}</p>
              ))}
            </div>
            <div>
              <p className="text-xs text-surface-secondary mb-1">Dikkat Edin:</p>
              {deepAnalysis.teklif_stratejisi.dikkat_noktalari.map((item, idx) => (
                <p key={idx} className="text-xs text-yellow-400">⚠ {item}</p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Başarı Kriterleri */}
      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-lg font-semibold text-surface-primary mb-4">Başarı Kriterleri</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {deepAnalysis.karar_onerisi.basari_kriterleri.map((kriter, idx) => (
            <div key={idx} className="p-3 bg-platinum-900/40 rounded-lg">
              <p className="text-sm text-surface-primary">{kriter}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Güven Skoru */}
      <div className="text-center p-4 bg-platinum-900/40 rounded-lg">
        <p className="text-sm text-surface-secondary mb-2">Analiz Güven Skoru</p>
        <p className={`text-3xl font-bold ${
          deepAnalysis.guven_skoru >= 0.8 ? 'text-green-400' :
          deepAnalysis.guven_skoru >= 0.6 ? 'text-yellow-400' :
          deepAnalysis.guven_skoru >= 0.4 ? 'text-orange-400' : 'text-red-400'
        }`}>
          {Math.round(deepAnalysis.guven_skoru * 100)}%
        </p>
        {deepAnalysis.guven_skoru < 0.6 && (
          <p className="text-xs text-orange-300 mt-2">⚠️ Bazı veriler eksik olabilir</p>
        )}
      </div>
    </motion.div>
  );
}