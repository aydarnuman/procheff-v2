import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ProposalState {
  proposalData: any;
  setProposalData: (data: any) => void;
  updateProposalData: (section: string, data: any) => void;
  reset: () => void;
}

const initialState = {
  proposalData: {
    cost: {
      peopleCount: 0,
      daysPerYear: 0,
      totalMeals: 0,
      breakfastCount: 0,
      breakfastPrice: 0,
      lunchCount: 0,
      lunchPrice: 0,
      dinnerCount: 0,
      dinnerPrice: 0,
      profitMargin: 15,
      vatRate: 20,
      subtotal: 0,
      distribution: [],
    },
    personnel: [],
    documents: {},
    timeline: {},
    risk: {},
    payment: {},
    materials: [],
    menu: {},
    operational: {
      items: [],
      contractDays: 365,
    },
  },
};

export const useProposalStore = create<ProposalState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProposalData: (data) => set({ proposalData: data }),

      updateProposalData: (section, data) => {
        const current = get().proposalData;
        set({
          proposalData: {
            ...current,
            [section]: data,
          },
        });
      },

      reset: () => set(initialState),
    }),
    {
      name: 'proposal-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
