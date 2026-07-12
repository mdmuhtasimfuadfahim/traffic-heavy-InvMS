import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { API_URL } from '../api/client';
import { useStore } from '../store/useStore';

const EVENTS = {
  STOCK_UPDATE: 'stock:update',
  DROP_CREATED: 'drop:created',
  PURCHASE_COMPLETED: 'purchase:completed',
  RESERVATION_EXPIRED: 'reservation:expired',
};

/**
 * Owns the single Socket.io connection for the app. Every connected browser
 * tab receives the same broadcast events, which is what keeps the "Live
 * Stock Count" in sync across tabs instantly, per the assessment brief.
 */
export function useSocket() {
  const socketRef = useRef(null);
  const applyStockUpdate = useStore((s) => s.applyStockUpdate);
  const applyPurchase = useStore((s) => s.applyPurchase);
  const addDrop = useStore((s) => s.addDrop);
  const clearReservation = useStore((s) => s.clearReservation);
  const myReservations = useStore((s) => s.myReservations);

  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on(EVENTS.STOCK_UPDATE, ({ dropId, availableStock }) => {
      applyStockUpdate(dropId, availableStock);
    });

    socket.on(EVENTS.DROP_CREATED, ({ drop }) => {
      addDrop(drop);
      toast(`New drop: ${drop.name}`, { icon: '🔥' });
    });

    socket.on(EVENTS.PURCHASE_COMPLETED, ({ dropId, purchase }) => {
      applyPurchase(dropId, purchase);
    });

    socket.on(EVENTS.RESERVATION_EXPIRED, ({ reservationId, dropId }) => {
      // Only react if it's *this* tab's reservation that expired.
      const mine = useStore.getState().myReservations[dropId];
      if (mine && mine.id === reservationId) {
        clearReservation(dropId);
        toast.error('Your reservation expired - stock was released.');
      }
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return socketRef;
}
