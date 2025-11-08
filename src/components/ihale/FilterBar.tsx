/**
 * İhale Robotu - Filter Bar Component
 * 
 * Features:
 * - Debounced search (250ms)
 * - City filter
 * - Sort controls
 * - Clear filters button
 */

"use client";

import { useEffect, useState } from "react";
import { useIhaleRobotuStore } from "@/lib/stores/ihale-robotu-store";
import { Search, X, SlidersHorizontal } from "lucide-react";

export function FilterBar() {
  const { filters, setFilters } = useIhaleRobotuStore((state) => ({
    filters: state.filters,
    setFilters: state.setFilters,
  }));

  // Local state for debounced search
  const [localSearch, setLocalSearch] = useState(filters.searchQuery || "");

  // Debounce search query (250ms)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters({ searchQuery: localSearch });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [localSearch, setFilters]);

  const handleClearFilters = () => {
    setLocalSearch("");
    setFilters({
      searchQuery: "",
      selectedCity: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  };

  const hasActiveFilters =
    localSearch ||
    filters.selectedCity ||
    filters.startDate ||
    filters.endDate;

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Kurum adı, şehir, başlık ara..."
          className="w-full pl-10 pr-10 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {localSearch && (
          <button
            onClick={() => setLocalSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Aramayı temizle"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Advanced Filters Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* City Filter */}
        <select
          value={filters.selectedCity || ""}
          onChange={(e) =>
            setFilters({
              selectedCity: e.target.value || undefined,
            })
          }
          className="px-3 py-1.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tüm Şehirler</option>
          <option value="İstanbul">İstanbul</option>
          <option value="Ankara">Ankara</option>
          <option value="İzmir">İzmir</option>
          <option value="Bursa">Bursa</option>
          <option value="Antalya">Antalya</option>
          {/* TODO: Dinamik şehir listesi store'dan gelmeli */}
        </select>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.startDate || ""}
            onChange={(e) =>
              setFilters({ startDate: e.target.value || undefined })
            }
            className="px-3 py-1.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Başlangıç"
          />
          <span className="text-muted-foreground">-</span>
          <input
            type="date"
            value={filters.endDate || ""}
            onChange={(e) =>
              setFilters({ endDate: e.target.value || undefined })
            }
            className="px-3 py-1.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Bitiş"
          />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-input rounded-lg hover:bg-accent transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Temizle
          </button>
        )}

        {/* Filter Count Badge */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
            <SlidersHorizontal className="h-3 w-3" />
            <span>
              {[
                localSearch,
                filters.selectedCity,
                filters.startDate,
                filters.endDate,
              ].filter(Boolean).length}{" "}
              filtre aktif
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
