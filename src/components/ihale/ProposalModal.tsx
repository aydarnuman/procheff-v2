"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, DollarSign, Users, Calendar, FileText, Utensils, ChevronDown } from "lucide-react";

interface ProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalData: any;
}

export function ProposalModal({ isOpen, onClose, proposalData }: ProposalModalProps) {
  const [openSections, setOpenSections] = useState({
    personnel: false,
    menu: false,
    operational: false,
    materials: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!proposalData) return null;

  const { cost, personnel, menu, operational, materials } = proposalData;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div
              className="w-full max-w-4xl max-h-[90vh] bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <FileText className="w-6 h-6 text-blue-400" />
                  Teklif Detayları
                </h2>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Maliyet Bilgileri */}
                {cost && (
                  <Section title="Maliyet Analizi" icon={<DollarSign className="w-5 h-5" />}>
                    {/* Özet Kartlar */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-xs text-blue-400 mb-1">Kişi Sayısı</p>
                        <p className="text-xl font-bold text-white">{cost.peopleCount?.toLocaleString() || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-xs text-green-400 mb-1">Toplam Öğün</p>
                        <p className="text-xl font-bold text-white">{cost.totalMeals?.toLocaleString() || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p className="text-xs text-purple-400 mb-1">Ara Toplam</p>
                        <p className="text-xl font-bold text-white">
                          {cost.subtotal ? `₺${(cost.subtotal / 1_000_000).toFixed(2)}M` : "N/A"}
                        </p>
                      </div>
                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-xs text-yellow-400 mb-1">Kar Marjı</p>
                        <p className="text-xl font-bold text-white">{cost.profitMargin ? `%${cost.profitMargin}` : "N/A"}</p>
                      </div>
                    </div>

                    {/* Detaylı Bilgiler */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <InfoItem label="Yıllık Gün" value={cost.daysPerYear?.toLocaleString() || "N/A"} />
                      <InfoItem label="KDV Oranı" value={cost.vatRate ? `%${cost.vatRate}` : "N/A"} />
                      <InfoItem
                        label="KDV Dahil Toplam"
                        value={cost.subtotal && cost.vatRate
                          ? `₺${(cost.subtotal * (1 + cost.vatRate / 100)).toLocaleString()}`
                          : "N/A"}
                      />
                      <InfoItem
                        label="Ortalama Öğün Fiyatı"
                        value={cost.subtotal && cost.totalMeals
                          ? `₺${(cost.subtotal / cost.totalMeals).toFixed(2)}`
                          : "N/A"}
                      />
                    </div>

                    {/* Dağılım Tablosu */}
                    {cost.distribution && cost.distribution.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">Öğün Dağılımı</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-white/10">
                                <th className="text-left py-2 px-3 text-gray-400 font-medium">Öğün Türü</th>
                                <th className="text-left py-2 px-3 text-gray-400 font-medium">Diyet Tipi</th>
                                <th className="text-right py-2 px-3 text-gray-400 font-medium">Adet</th>
                                <th className="text-right py-2 px-3 text-gray-400 font-medium">Birim Fiyat</th>
                                <th className="text-right py-2 px-3 text-gray-400 font-medium">Toplam</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cost.distribution
                                .filter((item: any) => item.adet > 0 || item.birimFiyat > 0)
                                .map((item: any, idx: number) => (
                                  <tr key={idx} className="border-b border-white/5">
                                    <td className="py-2 px-3 text-white">
                                      {formatMealType(item.mealType)}
                                    </td>
                                    <td className="py-2 px-3 text-gray-300">
                                      {formatDietType(item.dietType)}
                                    </td>
                                    <td className="py-2 px-3 text-right text-white">
                                      {item.adet?.toLocaleString() || 0}
                                    </td>
                                    <td className="py-2 px-3 text-right text-white">
                                      ₺{item.birimFiyat?.toFixed(2) || "0.00"}
                                    </td>
                                    <td className="py-2 px-3 text-right text-blue-400 font-semibold">
                                      ₺{item.toplam?.toLocaleString() || "0"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </Section>
                )}

                {/* Personel Bilgileri - Collapsible */}
                {personnel && personnel.length > 0 && (
                  <CollapsibleSection
                    title="Personel Planlaması"
                    icon={<Users className="w-5 h-5" />}
                    isOpen={openSections.personnel}
                    onToggle={() => toggleSection("personnel")}
                  >
                    {/* Özet */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <InfoItem
                        label="Toplam Personel"
                        value={personnel.reduce((sum: number, p: any) => sum + (p.count || 0), 0).toString()}
                      />
                      <InfoItem
                        label="Aylık Personel Maliyeti"
                        value={`₺${personnel
                          .reduce((sum: number, p: any) => sum + (p.count || 0) * (p.salary || 0), 0)
                          .toLocaleString()}`}
                      />
                      <InfoItem
                        label="Yıllık Personel Maliyeti"
                        value={`₺${(
                          personnel.reduce((sum: number, p: any) => sum + (p.count || 0) * (p.salary || 0), 0) * 12
                        ).toLocaleString()}`}
                      />
                    </div>

                    {/* Tablo */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Pozisyon</th>
                            <th className="text-right py-2 px-3 text-gray-400 font-medium">Adet</th>
                            <th className="text-right py-2 px-3 text-gray-400 font-medium">Aylık Maaş</th>
                            <th className="text-right py-2 px-3 text-gray-400 font-medium">Aylık Toplam</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personnel.map((person: any, idx: number) => (
                            <tr key={idx} className="border-b border-white/5">
                              <td className="py-2 px-3 text-white">{person.position || "Belirtilmemiş"}</td>
                              <td className="py-2 px-3 text-right text-white">{person.count || 0}</td>
                              <td className="py-2 px-3 text-right text-white">
                                ₺{person.salary?.toLocaleString() || "0"}
                              </td>
                              <td className="py-2 px-3 text-right text-blue-400 font-semibold">
                                ₺{((person.count || 0) * (person.salary || 0)).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Menü Bilgileri - Collapsible */}
                {menu && Object.keys(menu).length > 0 && (
                  <CollapsibleSection
                    title="Menü Planı"
                    icon={<Utensils className="w-5 h-5" />}
                    isOpen={openSections.menu}
                    onToggle={() => toggleSection("menu")}
                  >
                    <div className="text-sm text-gray-300">
                      <p>Menü bilgileri kaydedildi.</p>
                      {/* Menü detaylarını buraya ekleyebilirsiniz */}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Operasyonel Bilgiler - Collapsible */}
                {operational && operational.items && operational.items.length > 0 && (
                  <CollapsibleSection
                    title="Operasyonel Giderler"
                    icon={<Calendar className="w-5 h-5" />}
                    isOpen={openSections.operational}
                    onToggle={() => toggleSection("operational")}
                  >
                    <div className="space-y-2">
                      {operational.contractDays && (
                        <InfoItem label="Sözleşme Süresi" value={`${operational.contractDays} gün`} />
                      )}
                      <div className="mt-3">
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">Gider Kalemleri</h4>
                        <ul className="space-y-2">
                          {operational.items.map((item: any, idx: number) => (
                            <li key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-300">{item.name || "Belirtilmemiş"}</span>
                              <span className="text-blue-400 font-semibold">
                                ₺{item.amount?.toLocaleString() || "0"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Malzeme Listesi - Collapsible */}
                {materials && materials.length > 0 && (
                  <CollapsibleSection
                    title="Malzeme Listesi"
                    icon={<FileText className="w-5 h-5" />}
                    isOpen={openSections.materials}
                    onToggle={() => toggleSection("materials")}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {materials.map((material: any, idx: number) => (
                        <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/10">
                          <p className="text-white font-medium">{material.name || "Belirtilmemiş"}</p>
                          <p className="text-sm text-gray-400">
                            {material.quantity || "N/A"} {material.unit || ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Teklif verisi yoksa */}
                {!cost && !personnel && !menu && !operational && !materials && (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Bu ihale için henüz teklif hazırlanmamış.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Yardımcı Bileşenler
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-blue-400">{icon}</div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
      {/* Header - Clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="text-blue-400">{icon}</div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Content - Animated */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-white/10">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

// Format yardımcı fonksiyonlar
function formatMealType(mealType: string): string {
  const types: Record<string, string> = {
    sabah_kahvaltisi: "Sabah Kahvaltısı",
    ogle_yemegi: "Öğle Yemeği",
    aksam_yemegi: "Akşam Yemeği",
    ara_ogun: "Ara Öğün",
  };
  return types[mealType] || mealType;
}

function formatDietType(dietType: string): string {
  const types: Record<string, string> = {
    standart: "Standart",
    vejeteryan: "Vejeteryan",
    vegan: "Vegan",
    glutensiz: "Glutensiz",
    diyabetik: "Diyabetik",
  };
  return types[dietType] || dietType;
}
