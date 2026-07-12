import { create } from 'zustand';

const USERNAME_KEY = 'invms_username';
const USER_KEY = 'invms_user';

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useStore = create((set, get) => ({
  user: loadStoredUser(),
  drops: [],
  loading: true,
  // dropId -> { id, dropId, status, expiresAt }
  myReservations: {},

  setUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },

  logout: () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(USERNAME_KEY);
    set({ user: null, myReservations: {} });
  },

  setDrops: (drops) => set({ drops, loading: false }),

  addDrop: (drop) =>
    set((state) => ({
      drops: state.drops.some((d) => d.id === drop.id)
        ? state.drops
        : [{ ...drop, recentPurchasers: [] }, ...state.drops],
    })),

  applyStockUpdate: (dropId, availableStock) =>
    set((state) => ({
      drops: state.drops.map((d) =>
        d.id === dropId ? { ...d, availableStock, isSoldOut: availableStock <= 0 } : d
      ),
    })),

  applyPurchase: (dropId, purchase) =>
    set((state) => ({
      drops: state.drops.map((d) =>
        d.id === dropId
          ? {
              ...d,
              recentPurchasers: [purchase, ...(d.recentPurchasers || [])].slice(0, 3),
            }
          : d
      ),
    })),

  setReservation: (dropId, reservation) =>
    set((state) => ({
      myReservations: { ...state.myReservations, [dropId]: reservation },
    })),

  clearReservation: (dropId) =>
    set((state) => {
      const next = { ...state.myReservations };
      delete next[dropId];
      return { myReservations: next };
    }),

  getReservation: (dropId) => get().myReservations[dropId],
}));
