"use client";

import { useState, useMemo, Fragment } from "react";
import { Search, Plus, Loader2, ChefHat, Clock, Users, DollarSign, X, Building2, School, Factory, Landmark, Shield, Upload, FileText } from "lucide-react";
import { useMenuStore } from "@/lib/store/menu-store";
import type { Recipe, DishSuggestion, InstitutionType } from "@/types/menu";

export default function MenuPoolPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingRecipe, setIsFetchingRecipe] = useState(false);
  const [suggestion, setSuggestion] = useState<DishSuggestion | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isEditingGramaj, setIsEditingGramaj] = useState(false);
  const [editedRecipe, setEditedRecipe] = useState<Recipe | null>(null);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkInputMode, setBulkInputMode] = useState<"text" | "file">("text");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const { recipes, addRecipe, updateRecipe, deleteRecipe, selectedInstitution, setSelectedInstitution, addRecipeToInstitution, removeRecipeFromInstitution } = useMenuStore();

  const getInstitutionIcon = (id: InstitutionType) => {
    switch (id) {
      case "hastane": return Building2;
      case "okul": return School;
      case "fabrika": return Factory;
      case "belediye": return Landmark;
      case "askeri": return Shield;
    }
  };

  const institutions: { id: InstitutionType; label: string }[] = [
    { id: "hastane", label: "Hastane" },
    { id: "okul", label: "Okul" },
    { id: "fabrika", label: "Fabrika" },
    { id: "belediye", label: "Belediye" },
    { id: "askeri", label: "Askeri" },
  ];

  // Görüntülenecek tarifler
  const displayedRecipes = useMemo(() => {
    if (selectedInstitution === null) {
      // Özel Havuz: Sadece kuruma atanmamış tarifler
      return recipes.filter(recipe => !recipe.institutions || recipe.institutions.length === 0);
    } else {
      // Kurum Menüsü: Sadece o kuruma eklenmiş tarifler
      return recipes.filter(recipe => recipe.institutions?.includes(selectedInstitution));
    }
  }, [recipes, selectedInstitution]);

  // Yemek arama ve öneri
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSuggestion(null);

    try {
      const response = await fetch("/api/ai/suggest-dish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      const data = await response.json();

      if (data.success) {
        setSuggestion(data.suggestion);
      } else {
        alert("Yemek önerisi alınamadı: " + data.error);
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("Bir hata oluştu");
    } finally {
      setIsSearching(false);
    }
  };

  // Reçete detayını getir
  const handleGetRecipe = async (dishName: string) => {
    setIsFetchingRecipe(true);

    try {
      const response = await fetch("/api/ai/dish-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dishName,
          // Özel Havuz için "standart" kullan, yoksa seçili kurumu kullan
          institutionType: selectedInstitution || "standart"
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Aynı yemek var mı kontrol et
        const existingRecipe = recipes.find(
          r => r.name.toLowerCase().trim() === data.recipe.name.toLowerCase().trim()
        );

        if (existingRecipe) {
          alert(`"${data.recipe.name}" zaten mevcut. Lütfen başka bir yemek seçin.`);
          setSuggestion(null);
          setSearchQuery("");
          return;
        }

        const newRecipe: Recipe = {
          id: Date.now().toString(),
          ...data.recipe,
          // Genel havuzda ise boş array, kurum seçiliyse o kuruma ekle
          institutions: selectedInstitution ? [selectedInstitution] : [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        addRecipe(newRecipe);
        setSelectedRecipe(newRecipe);
        setSuggestion(null);
        setSearchQuery("");
      } else {
        alert("Reçete alınamadı: " + data.error);
      }
    } catch (error) {
      console.error("Recipe fetch error:", error);
      alert("Bir hata oluştu");
    } finally {
      setIsFetchingRecipe(false);
    }
  };

  const categoryLabels = {
    corba: "Çorba",
    ana_yemek: "Ana Yemek",
    pilav: "Pilav",
    salata: "Salata",
    tatli: "Tatlı",
    icecek: "İçecek",
    aperatif: "Aperatif",
  };


  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header with Institution Selector */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-primary mb-2 flex items-center gap-3">
            <ChefHat className="w-8 h-8 text-primary-400" />
            Menü Havuzu
          </h1>
          <p className="text-surface-secondary">
            AI destekli yemek arama ve reçete yönetimi
          </p>
        </div>

        {/* Institution Selector */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Toplu Ekleme Butonu */}
          <button
            type="button"
            onClick={() => setShowBulkAddModal(true)}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 shadow-lg hover:shadow-green-500/50"
          >
            <Upload className="w-3.5 h-3.5" />
            Toplu Ekle
          </button>

          <div className="flex flex-wrap gap-2 flex-1 justify-end">
            {/* Özel Havuz Butonu */}
            <button
              type="button"
              onClick={() => setSelectedInstitution(null)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                selectedInstitution === null
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/50"
                  : "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
              }`}
            >
              <ChefHat className="w-4 h-4" />
              Özel Havuz
            </button>

            {/* Kurum Butonları */}
            {institutions.map((inst) => {
              const Icon = getInstitutionIcon(inst.id);
              return (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => setSelectedInstitution(inst.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    selectedInstitution === inst.id
                      ? "bg-primary-600 text-white shadow-lg shadow-primary-500/50"
                      : "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {inst.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-6 shadow-lg">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Yemek adı yazın..."
              lang="tr"
              spellCheck="true"
              autoComplete="off"
              className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white/15 transition-all"
              disabled={isSearching || isFetchingRecipe}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || isFetchingRecipe || !searchQuery.trim()}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg hover:shadow-primary-500/50"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="hidden sm:inline">Aranıyor...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span className="hidden sm:inline">Ara</span>
              </>
            )}
          </button>
        </div>

        {/* AI Suggestion */}
        {suggestion && (
          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-200 mb-2">
              <strong>"{suggestion.original}"</strong> yerine{" "}
              <strong>"{suggestion.suggested}"</strong> mi demek istediniz?
              {suggestion.confidence && (
                <span className="ml-2 text-xs text-blue-300">
                  (%{suggestion.confidence} emin)
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleGetRecipe(suggestion.suggested)}
                disabled={isFetchingRecipe}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                {isFetchingRecipe ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Getiriliyor...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Evet, Getir
                  </>
                )}
              </button>
              <button
                onClick={() => setSuggestion(null)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-xs font-medium transition-colors"
              >
                Hayır
              </button>
            </div>

            {suggestion.alternatives && suggestion.alternatives.length > 0 && (
              <div className="mt-2 pt-2 border-t border-blue-500/20">
                <p className="text-xs text-blue-300 mb-1.5">Diğer öneriler:</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestion.alternatives.map((alt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleGetRecipe(alt)}
                      disabled={isFetchingRecipe}
                      className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 rounded text-xs transition-colors"
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recipe List - Clean Grid Cards */}
      <div>
        {selectedInstitution === null ? (
          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
              <ChefHat className="w-6 h-6 text-white" />
            </span>
            Özel Menü Havuzu ({displayedRecipes.length} tarif)
          </h2>
        ) : (
          <h2 className="text-xl font-bold text-surface-primary mb-4">
            {institutions.find(i => i.id === selectedInstitution)?.label} Menüsü ({displayedRecipes.length} tarif)
          </h2>
        )}

        {displayedRecipes.length === 0 ? (
          <div className="text-center py-12 bg-surface-card border border-surface-border rounded-xl">
            <ChefHat className="w-16 h-16 text-surface-tertiary mx-auto mb-4" />
            <p className="text-surface-secondary mb-2">
              {selectedInstitution === null
                ? "Henüz tarif eklenmemiş"
                : "Bu kuruma ait henüz tarif eklenmemiş"
              }
            </p>
            <p className="text-surface-tertiary text-sm">
              {selectedInstitution === null
                ? "Yukarıdan yemek arayarak genel havuza tarif ekleyin"
                : "Genel havuzdan tarifler ekleyebilirsiniz"
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {displayedRecipes.map((recipe) => (
              <div key={recipe.id} className="relative group">
                <button
                  type="button"
                  onClick={() => setSelectedRecipe(recipe)}
                  className="w-full bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-lg p-3 transition-all text-left shadow-md border border-white/10"
                >
                  {/* Category badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 bg-white/10 text-gray-200 rounded text-[10px] font-medium">
                      {categoryLabels[recipe.category]}
                    </span>
                    <ChefHat className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>

                {/* Recipe name */}
                <h3 className="text-sm font-semibold text-white group-hover:text-primary-400 transition-colors mb-2 line-clamp-2 min-h-10">
                  {recipe.name}
                </h3>

                {/* Info */}
                <div className="space-y-1.5 text-xs text-gray-300">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-gray-400" />
                    <span>{recipe.servings} kişi</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span>{recipe.prepTime + recipe.cookTime} dk</span>
                  </div>
                  {recipe.cost && (
                    <div className="flex items-center gap-1.5 text-green-400 font-medium pt-1.5 border-t border-white/10">
                      <DollarSign className="w-3 h-3" />
                      <span>₺{recipe.cost.toFixed(0)}</span>
                    </div>
                  )}
                </div>
              </button>

              {/* Delete button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRecipe(recipe.id);
                }}
                aria-label="Tarifi sil"
                className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            ))}
          </div>
        )}
      </div>

      {/* Toplu Ekleme Modal */}
      {showBulkAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Toplu Menü Ekle</h3>
              <button
                type="button"
                onClick={() => {
                  setShowBulkAddModal(false);
                  setBulkText("");
                  setUploadedFile(null);
                  setBulkInputMode("text");
                }}
                aria-label="Modalı kapat"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tab Selector */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setBulkInputMode("text")}
                className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  bulkInputMode === "text"
                    ? "bg-primary-600 text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                <FileText className="w-4 h-4" />
                Metin Gir
              </button>
              <button
                type="button"
                onClick={() => setBulkInputMode("file")}
                className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  bulkInputMode === "file"
                    ? "bg-primary-600 text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                <Upload className="w-4 h-4" />
                Dosya Yükle
              </button>
            </div>

            {/* Content Area */}
            <div className="mb-4">
              {bulkInputMode === "text" ? (
                <>
                  <p className="text-sm text-gray-400 mb-2">
                    Menü isimlerini her satıra bir tane gelecek şekilde yapıştırın:
                  </p>
                  <p className="text-xs text-blue-400 mb-2">
                    İpucu: Kısa isimler de yazabilirsiniz (örn: "brokoli", "pirasa"). AI otomatik olarak tam yemek adına çevirir.
                  </p>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="Örnek:&#10;Mercimek Çorbası&#10;brokoli&#10;pirasa&#10;Pilav"
                    lang="tr"
                    spellCheck="true"
                    autoComplete="off"
                    className="w-full h-64 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400 mb-2">
                    PDF veya Word dosyası seçin (menü listesi içeren):
                  </p>
                  <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadedFile(file);
                        }
                      }}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="w-12 h-12 text-gray-400" />
                      <span className="text-gray-400">
                        {uploadedFile ? uploadedFile.name : "Dosya seçmek için tıklayın"}
                      </span>
                      <span className="text-xs text-gray-500">PDF, Word veya TXT</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowBulkAddModal(false);
                  setBulkText("");
                  setUploadedFile(null);
                  setBulkInputMode("text");
                }}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg font-medium transition-all border border-white/10"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={async () => {
                  let lines: string[] = [];

                  if (bulkInputMode === "text") {
                    lines = bulkText.split('\n').filter(line => line.trim());
                    if (lines.length === 0) {
                      alert('Lütfen en az bir menü ismi girin');
                      return;
                    }
                  } else {
                    if (!uploadedFile) {
                      alert('Lütfen bir dosya seçin');
                      return;
                    }

                    const formData = new FormData();
                    formData.append('file', uploadedFile);

                    try {
                      const extractResponse = await fetch('/api/ai/extract-menu', {
                        method: 'POST',
                        body: formData
                      });

                      if (extractResponse.ok) {
                        const { menuItems } = await extractResponse.json();
                        lines = menuItems;
                      } else {
                        alert('Dosya işlenirken hata oluştu');
                        return;
                      }
                    } catch (error) {
                      console.error('File processing error:', error);
                      alert('Dosya işlenirken hata oluştu');
                      return;
                    }
                  }

                  const targetInstitution = selectedInstitution || 'standart';

                  setIsBulkProcessing(true);

                  try {
                    // Toplu API çağrısı - tüm menüler tek seferde
                    const response = await fetch('/api/ai/bulk-recipes', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        dishNames: lines.map(line => line.trim()),
                        institutionType: targetInstitution
                      })
                    });

                    if (response.ok) {
                      const { recipes: newRecipes } = await response.json();

                      // Mevcut yemekleri kontrol et
                      const existingNames = recipes.map(r => r.name.toLowerCase().trim());
                      const duplicates: string[] = [];
                      const toAdd: any[] = [];

                      newRecipes.forEach((recipe: any) => {
                        const recipeName = recipe.name.toLowerCase().trim();
                        if (existingNames.includes(recipeName)) {
                          duplicates.push(recipe.name);
                        } else {
                          toAdd.push(recipe);
                        }
                      });

                      // Uyarı göster
                      if (duplicates.length > 0) {
                        alert(`Aşağıdaki yemekler zaten mevcut, eklenmedi:\n\n${duplicates.join('\n')}\n\n${toAdd.length} yeni yemek eklendi.`);
                      }

                      // Sadece yeni tarifleri ekle
                      toAdd.forEach((recipe: any) => {
                        addRecipe(recipe);
                        if (targetInstitution !== 'standart') {
                          addRecipeToInstitution(recipe.id, targetInstitution as InstitutionType);
                        }
                      });
                    } else {
                      alert('Toplu ekleme sırasında hata oluştu');
                    }
                  } catch (error) {
                    console.error('Bulk processing error:', error);
                    alert('Toplu ekleme sırasında hata oluştu');
                  }

                  setIsBulkProcessing(false);
                  setShowBulkAddModal(false);
                  setBulkText("");
                  setUploadedFile(null);
                  setBulkInputMode("text");
                }}
                disabled={isBulkProcessing || (bulkInputMode === "text" ? !bulkText.trim() : !uploadedFile)}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                {isBulkProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    İşleniyor...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Ekle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSelectedRecipe(null);
            setIsEditingGramaj(false);
            setEditedRecipe(null);
          }}
        >
          <div
            className="bg-surface-card border border-surface-border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-surface-card border-b border-surface-border p-4 flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-2">
                  {selectedRecipe.name}
                </h2>
                <div className="flex items-center gap-3 text-sm text-gray-300 flex-wrap">
                  <span className="px-2 py-1 bg-white/10 text-gray-200 rounded text-xs font-medium">
                    {categoryLabels[selectedRecipe.category]}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {selectedRecipe.servings} kişilik
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {selectedRecipe.prepTime + selectedRecipe.cookTime} dakika
                  </span>
                  {selectedRecipe.cost && (
                    <span className="flex items-center gap-1 text-green-400 font-semibold">
                      <DollarSign className="w-4 h-4" />
                      ₺{selectedRecipe.cost.toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedRecipe(null);
                  setIsEditingGramaj(false);
                  setEditedRecipe(null);
                }}
                aria-label="Tarif detayını kapat"
                className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 grid md:grid-cols-2 gap-6">
              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-primary-400" />
                    Malzemeler ({selectedRecipe.servings} kişilik)
                  </h3>
                  <button
                    onClick={() => {
                      if (isEditingGramaj) {
                        // Kaydet
                        if (editedRecipe) {
                          updateRecipe(editedRecipe.id, {
                            ingredients: editedRecipe.ingredients,
                            updatedAt: new Date().toISOString()
                          });
                          setSelectedRecipe(editedRecipe);
                        }
                        setIsEditingGramaj(false);
                      } else {
                        // Düzenleme moduna geç
                        setEditedRecipe({ ...selectedRecipe });
                        setIsEditingGramaj(true);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isEditingGramaj
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isEditingGramaj ? "💾 Kaydet" : "✏️ Gramaj Düzenle"}
                  </button>
                </div>
                <div className="space-y-2">
                  {(isEditingGramaj ? editedRecipe?.ingredients : selectedRecipe.ingredients)?.map((ing, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <span className="text-gray-200 text-sm flex-1">{ing.name}</span>
                      {isEditingGramaj ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={ing.amount}
                            onChange={(e) => {
                              if (editedRecipe) {
                                const newIngredients = [...editedRecipe.ingredients];
                                newIngredients[idx] = {
                                  ...newIngredients[idx],
                                  amount: parseFloat(e.target.value) || 0
                                };
                                setEditedRecipe({
                                  ...editedRecipe,
                                  ingredients: newIngredients
                                });
                              }
                            }}
                            aria-label={`${ing.name} miktarı`}
                            className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-right focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-gray-400 text-sm w-12">{ing.unit}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 font-semibold text-sm ml-3">
                          {ing.amount} {ing.unit}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div>
                <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Hazırlanışı
                </h3>
                <ol className="space-y-2">
                  {selectedRecipe.instructions?.map((step, idx) => (
                    <li
                      key={idx}
                      className="flex gap-3 p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-gray-300 text-sm leading-relaxed">{step}</span>
                    </li>
                  )) || <p className="text-gray-400 text-sm">Tarif adımları bulunamadı</p>}
                </ol>
              </div>
            </div>

            {/* Notes */}
            {selectedRecipe.notes && (
              <div className="px-6">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-sm text-amber-200">
                    <strong>Not:</strong> {selectedRecipe.notes}
                  </p>
                </div>
              </div>
            )}

            {/* Institution Management */}
            <div className="px-6 pb-6 pt-4 border-t border-surface-border">
              <h3 className="text-sm font-semibold text-white mb-3">Kurum Menülerine Ekle/Çıkar</h3>
              <div className="flex flex-wrap gap-2">
                {institutions.map((inst) => {
                  const Icon = getInstitutionIcon(inst.id);
                  const isInInstitution = selectedRecipe.institutions.includes(inst.id);

                  return (
                    <button
                      key={inst.id}
                      onClick={() => {
                        if (isInInstitution) {
                          removeRecipeFromInstitution(selectedRecipe.id, inst.id);
                        } else {
                          addRecipeToInstitution(selectedRecipe.id, inst.id);
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isInInstitution
                          ? "bg-primary-600 text-white"
                          : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {inst.label}
                      {isInInstitution && <span className="ml-1">✓</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Bu tarif {selectedRecipe.institutions.length} kurumda kullanılıyor
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
