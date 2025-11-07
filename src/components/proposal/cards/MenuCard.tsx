"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, UtensilsCrossed, Plus, Trash2 } from "lucide-react";
import { MenuDay } from "@/types/ai";

interface MenuCardProps {
  data: any;
  onChange: (data: any) => void;
}

export function MenuCard({ data, onChange }: MenuCardProps) {
  const [localData, setLocalData] = useState<MenuDay[]>(() => {
    // Sadece data prop'u kullan - analysis'e erişme
    if (data && Array.isArray(data) && data.length > 0) {
      return data;
    }
    return [];
  });

  const [openDays, setOpenDays] = useState<number[]>([1]); // İlk gün açık

  // Parent'a değişiklikleri ilet
  useEffect(() => {
    onChange(localData);
  }, [localData]);

  const toggleDay = (day: number) => {
    if (openDays.includes(day)) {
      setOpenDays(openDays.filter(d => d !== day));
    } else {
      setOpenDays([...openDays, day]);
    }
  };

  const handleAddDay = () => {
    const newDay: MenuDay = {
      gun: localData.length + 1,
      gun_adi: "",
      corba: { adi: "", gramaj: "" },
      ana_yemek: { adi: "", gramaj: "" },
      yan_yemek: { adi: "", gramaj: "" },
      salata: { adi: "", gramaj: "" },
      tatli: { adi: "", gramaj: "" },
    };
    setLocalData([...localData, newDay]);
    setOpenDays([...openDays, newDay.gun]);
  };

  const handleDeleteDay = (gun: number) => {
    setLocalData(localData.filter((day) => day.gun !== gun));
  };

  const handleChange = (gun: number, field: string, subfield: string, value: string) => {
    setLocalData(
      localData.map((day) => {
        if (day.gun === gun) {
          if (field === "gun_adi") {
            return { ...day, gun_adi: value };
          } else {
            return {
              ...day,
              [field]: {
                ...(day[field as keyof MenuDay] as any),
                [subfield]: value,
              },
            };
          }
        }
        return day;
      })
    );
  };

  const formatDayName = (day: MenuDay) => {
    if (day.gun_adi) {
      return `${day.gun}. Gün - ${day.gun_adi}`;
    }
    return `${day.gun}. Gün`;
  };

  if (localData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white">Menü Programı</h3>
            <p className="text-gray-400 mt-1">
              İhale şartnamesinden örnek menü programı
            </p>
          </div>
          <button
            onClick={handleAddDay}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Gün Ekle</span>
          </button>
        </div>

        <div className="p-12 bg-gray-900/50 border-2 border-dashed border-gray-700 rounded-xl text-center">
          <UtensilsCrossed className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">Menü Programı Bulunamadı</p>
          <p className="text-gray-500 text-sm mb-6">
            İhale dökümanında örnek menü programı tespit edilemedi.<br />
            Manuel olarak menü ekleyebilirsiniz.
          </p>

          <button
            onClick={handleAddDay}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>Manuel Ekle</span>
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
          <h3 className="text-2xl font-bold text-white">Menü Programı</h3>
          <p className="text-gray-400 mt-1">
            {localData.length} günlük örnek menü - İhtiyacınıza göre düzenleyebilirsiniz
          </p>
        </div>
        <button
          onClick={handleAddDay}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Gün Ekle</span>
        </button>
      </div>

      {/* AI Öneri Kutusu - Kaldırıldı (serialization sorunu) */}

      {/* Özet Kartlar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-br from-orange-600/10 to-orange-600/5 border border-orange-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Toplam Gün</p>
          <p className="text-2xl font-bold text-orange-400">{localData.length}</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-green-600/10 to-green-600/5 border border-green-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Ana Yemek</p>
          <p className="text-2xl font-bold text-green-400">
            {localData.filter((d) => d.ana_yemek?.adi).length}
          </p>
        </div>
        <div className="p-4 bg-gradient-to-br from-blue-600/10 to-blue-600/5 border border-blue-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Çorba</p>
          <p className="text-2xl font-bold text-blue-400">
            {localData.filter((d) => d.corba?.adi).length}
          </p>
        </div>
        <div className="p-4 bg-gradient-to-br from-purple-600/10 to-purple-600/5 border border-purple-600/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Tatlı</p>
          <p className="text-2xl font-bold text-purple-400">
            {localData.filter((d) => d.tatli?.adi).length}
          </p>
        </div>
      </div>

      {/* Accordion Menü Listesi */}
      <div className="space-y-3">
        {localData.map((day) => {
          const isOpen = openDays.includes(day.gun);

          return (
            <div
              key={day.gun}
              className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => toggleDay(day.gun)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-bold">
                    {day.gun}
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold">{formatDayName(day)}</p>
                    <p className="text-xs text-gray-400">
                      {day.ana_yemek?.adi || "Ana yemek girilmedi"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDay(day.gun);
                    }}
                    className="p-2 hover:bg-red-600/20 rounded transition-colors"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                  </button>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Content */}
              {isOpen && (
                <div className="p-6 border-t border-gray-700 bg-gray-900/30 space-y-4">
                  {/* Gün Adı */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Gün Adı (Opsiyonel)
                    </label>
                    <input
                      type="text"
                      value={day.gun_adi || ""}
                      onChange={(e) =>
                        handleChange(day.gun, "gun_adi", "", e.target.value)
                      }
                      className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-colors"
                      placeholder="Örn: Pazartesi"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Çorba */}
                    <div className="bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <h5 className="text-sm font-semibold text-blue-400">Çorba</h5>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={day.corba?.adi || ""}
                          onChange={(e) =>
                            handleChange(day.gun, "corba", "adi", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                          placeholder="Çorba adı"
                        />
                        <input
                          type="text"
                          value={day.corba?.gramaj || ""}
                          onChange={(e) =>
                            handleChange(day.gun, "corba", "gramaj", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                          placeholder="Gramaj (örn: 150ml)"
                        />
                      </div>
                    </div>

                    {/* Ana Yemek */}
                    <div className="bg-gradient-to-br from-orange-500/5 to-red-500/5 border border-orange-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <h5 className="text-sm font-semibold text-orange-400">Ana Yemek</h5>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={day.ana_yemek?.adi || ""}
                          onChange={(e) =>
                            handleChange(day.gun, "ana_yemek", "adi", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-colors"
                          placeholder="Ana yemek adı"
                        />
                        <input
                          type="text"
                          value={day.ana_yemek?.gramaj || ""}
                          onChange={(e) =>
                            handleChange(day.gun, "ana_yemek", "gramaj", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-colors"
                          placeholder="Gramaj (örn: 200gr)"
                        />
                      </div>
                    </div>

                    {/* Yan Yemek */}
                    <div className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border border-green-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <h5 className="text-sm font-semibold text-green-400">Yan Yemek</h5>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={day.yan_yemek?.adi || ""}
                          onChange={(e) =>
                            handleChange(day.gun, "yan_yemek", "adi", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-white text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-colors"
                          placeholder="Yan yemek adı"
                        />
                        <input
                          type="text"
                          value={day.yan_yemek?.gramaj || ""}
                          onChange={(e) =>
                            handleChange(day.gun, "yan_yemek", "gramaj", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-white text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-colors"
                          placeholder="Gramaj (örn: 150gr)"
                        />
                      </div>
                    </div>

                    {/* Salata */}
                    <div className="bg-gradient-to-br from-teal-500/5 to-cyan-500/5 border border-teal-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                        <h5 className="text-sm font-semibold text-teal-400">Salata</h5>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={day.salata?.adi || ""}
                          onChange={(e) =>
                            handleChange(day.gun, "salata", "adi", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-white text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-colors"
                          placeholder="Salata adı"
                        />
                        <input
                          type="text"
                          value={day.salata?.gramaj || ""}
                          onChange={(e) =>
                            handleChange(day.gun, "salata", "gramaj", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-white text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-colors"
                          placeholder="Gramaj (örn: 100gr)"
                        />
                      </div>
                    </div>

                    {/* Tatlı */}
                    <div className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20 rounded-lg p-4 md:col-span-2">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <h5 className="text-sm font-semibold text-purple-400">Tatlı</h5>
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={day.tatli?.adi || ""}
                          onChange={(e) =>
                            handleChange(day.gun, "tatli", "adi", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors"
                          placeholder="Tatlı adı"
                        />
                        <input
                          type="text"
                          value={day.tatli?.gramaj || ""}
                          onChange={(e) =>
                            handleChange(day.gun, "tatli", "gramaj", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors"
                          placeholder="Gramaj (örn: 120gr)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Notlar */}
      <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
        <label htmlFor="menu-notes" className="block text-sm font-medium text-gray-400 mb-2">
          Menü Notları
        </label>
        <textarea
          id="menu-notes"
          name="menu-notes"
          placeholder="Menü ile ilgili özel notlarınızı, değişiklik isteklerinizi veya önerileri buraya yazabilirsiniz..."
          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-colors resize-none"
          rows={3}
        />
      </div>
    </div>
  );
}
