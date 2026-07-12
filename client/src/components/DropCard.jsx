import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useStore } from '../store/useStore';
import Countdown from './Countdown';

function formatPrice(price) {
  return `$${Number(price).toFixed(2)}`;
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function DropCard({ drop }) {
  const user = useStore((s) => s.user);
  const reservation = useStore((s) => s.myReservations[drop.id]);
  const setReservation = useStore((s) => s.setReservation);
  const clearReservation = useStore((s) => s.clearReservation);

  const [reserving, setReserving] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const notStarted = !drop.isLive;
  const soldOut = drop.availableStock <= 0 && !reservation;

  async function handleReserve() {
    setReserving(true);
    try {
      const { reservation: created } = await api.reserve(drop.id, user.id);
      setReservation(drop.id, created);
      toast.success('Reserved! You have 60 seconds to complete your purchase.');
    } catch (err) {
      if (err.status === 409) {
        toast.error(err.message || 'Sold out - someone beat you to it!');
      } else {
        toast.error(err.message || 'Could not reserve this item.');
      }
    } finally {
      setReserving(false);
    }
  }

  async function handlePurchase() {
    setPurchasing(true);
    try {
      await api.purchase(reservation.id, user.id);
      clearReservation(drop.id);
      toast.success(`Purchase complete! Enjoy your ${drop.name}.`);
    } catch (err) {
      clearReservation(drop.id);
      toast.error(err.message || 'Purchase failed.');
    } finally {
      setPurchasing(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.cancel(reservation.id, user.id);
      clearReservation(drop.id);
      toast('Reservation cancelled, stock released.', { icon: '↩️' });
    } catch (err) {
      toast.error(err.message || 'Could not cancel.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold leading-tight">{drop.name}</h2>
          <p className="text-gray-400 text-sm">{formatPrice(drop.price)}</p>
        </div>
        <div className="text-right">
          <div
            className={`text-2xl font-extrabold tabular-nums transition-colors ${
              drop.availableStock <= 0
                ? 'text-red-500'
                : drop.availableStock <= 3
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}
          >
            {drop.availableStock}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            of {drop.totalStock} left
          </div>
        </div>
      </div>

      {notStarted ? (
        <div className="text-sm text-gray-500 bg-gray-800/60 rounded-lg px-3 py-2">
          Drops {new Date(drop.startsAt).toLocaleString()}
        </div>
      ) : reservation ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2">
            <span className="text-sm text-gray-300">Reserved - complete purchase within</span>
            <Countdown
              expiresAt={reservation.expiresAt}
              onExpire={() => clearReservation(drop.id)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePurchase}
              disabled={purchasing}
              className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed py-2 font-semibold transition-colors"
            >
              {purchasing ? 'Completing…' : 'Complete Purchase'}
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-lg border border-gray-700 hover:border-gray-500 disabled:opacity-50 px-3 py-2 text-sm text-gray-300 transition-colors"
            >
              {cancelling ? '…' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleReserve}
          disabled={reserving || soldOut}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed py-2 font-semibold transition-colors"
        >
          {reserving ? 'Reserving…' : soldOut ? 'Sold Out' : 'Reserve'}
        </button>
      )}

      <div className="border-t border-gray-800 pt-2">
        <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
          Recent purchasers
        </p>
        {drop.recentPurchasers && drop.recentPurchasers.length > 0 ? (
          <ul className="text-sm text-gray-300 space-y-0.5">
            {drop.recentPurchasers.map((p, i) => (
              <li key={i} className="flex justify-between">
                <span>{p.username}</span>
                <span className="text-gray-500">{timeAgo(p.purchasedAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">No purchases yet</p>
        )}
      </div>
    </div>
  );
}
