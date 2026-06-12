import { create } from 'zustand';
import { Reconciliation } from '../types';
import { inventoryAPI } from '../services/api';

interface ReconState {
  reconciliations: Reconciliation[];
  latestRecon: Reconciliation | null;
  loading: boolean;
  error: string | null;
  fetchReconciliations: () => Promise<void>;
  startPolling: (intervalMs?: number) => () => void;
}

export const useReconStore = create<ReconState>((set, get) => ({
  reconciliations: [],
  latestRecon: null,
  loading: false,
  error: null,

  fetchReconciliations: async () => {
    set({ loading: true, error: null });
    try {
      const res = await inventoryAPI.listReconciliations();
      const list = res.data || [];
      // The latest completed reconciliation is the first completed run in the list
      const completed = list.find((r: Reconciliation) => r.status === 'COMPLETED') || null;
      set({
        reconciliations: list,
        latestRecon: completed,
        loading: false,
      });
    } catch (err: any) {
      set({
        error: err.message || 'Failed to fetch reconciliations',
        loading: false,
      });
    }
  },

  startPolling: (intervalMs = 5000) => {
    // Fetch initial
    get().fetchReconciliations();

    const interval = setInterval(() => {
      get().fetchReconciliations();
    }, intervalMs);

    return () => clearInterval(interval);
  },
}));
