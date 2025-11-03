import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Recipe, InstitutionType } from "@/types/menu";

interface MenuStore {
  recipes: Recipe[];
  selectedInstitution: InstitutionType | null; // null = Genel Havuz
  setSelectedInstitution: (institution: InstitutionType | null) => void;
  addRecipe: (recipe: Recipe) => void;
  updateRecipe: (id: string, recipe: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  addRecipeToInstitution: (recipeId: string, institution: InstitutionType) => void;
  removeRecipeFromInstitution: (recipeId: string, institution: InstitutionType) => void;
  getRecipeById: (id: string) => Recipe | undefined;
  getRecipesByCategory: (category: Recipe["category"]) => Recipe[];
  getRecipesByInstitution: (institution: InstitutionType) => Recipe[];
  getGeneralRecipes: () => Recipe[]; // Genel havuzdaki tüm tarifler
  searchRecipes: (query: string) => Recipe[];
}

export const useMenuStore = create<MenuStore>()(
  persist(
    (set, get) => ({
      recipes: [],
      selectedInstitution: null, // Başlangıçta Genel Havuz

      setSelectedInstitution: (institution) =>
        set({ selectedInstitution: institution }),

      addRecipe: (recipe) =>
        set((state) => ({
          recipes: [...state.recipes, recipe],
        })),

      updateRecipe: (id, updatedRecipe) =>
        set((state) => ({
          recipes: state.recipes.map((recipe) =>
            recipe.id === id
              ? { ...recipe, ...updatedRecipe, updatedAt: new Date().toISOString() }
              : recipe
          ),
        })),

      deleteRecipe: (id) =>
        set((state) => ({
          recipes: state.recipes.filter((recipe) => recipe.id !== id),
        })),

      addRecipeToInstitution: (recipeId, institution) =>
        set((state) => ({
          recipes: state.recipes.map((recipe) =>
            recipe.id === recipeId
              ? {
                  ...recipe,
                  institutions: [...new Set([...(recipe.institutions || []), institution])],
                  updatedAt: new Date().toISOString(),
                }
              : recipe
          ),
        })),

      removeRecipeFromInstitution: (recipeId, institution) =>
        set((state) => ({
          recipes: state.recipes.map((recipe) =>
            recipe.id === recipeId
              ? {
                  ...recipe,
                  institutions: (recipe.institutions || []).filter((i) => i !== institution),
                  updatedAt: new Date().toISOString(),
                }
              : recipe
          ),
        })),

      getRecipeById: (id) => {
        return get().recipes.find((recipe) => recipe.id === id);
      },

      getRecipesByCategory: (category) => {
        return get().recipes.filter((recipe) => recipe.category === category);
      },

      getRecipesByInstitution: (institution) => {
        return get().recipes.filter((recipe) => recipe.institutions.includes(institution));
      },

      getGeneralRecipes: () => {
        return get().recipes; // Tüm tarifler
      },

      searchRecipes: (query) => {
        const lowerQuery = query.toLowerCase();
        const { selectedInstitution } = get();

        if (selectedInstitution === null) {
          // Genel havuzda: tüm tarifler
          return get().recipes.filter((recipe) =>
            recipe.name.toLowerCase().includes(lowerQuery)
          );
        } else {
          // Kurumda: sadece o kuruma eklenmiş tarifler
          return get().recipes.filter(
            (recipe) =>
              recipe.name.toLowerCase().includes(lowerQuery) &&
              recipe.institutions.includes(selectedInstitution)
          );
        }
      },
    }),
    {
      name: "procheff-menu-store",
      version: 4,
      migrate: (persistedState: unknown) => {
        // Eski versiyondan temiz başlat
        return {
          recipes: [],
          selectedInstitution: null,
        };
      },
    }
  )
);
