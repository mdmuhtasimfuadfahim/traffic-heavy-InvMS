import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { api } from './api/client';
import { useStore } from './store/useStore';
import { useSocket } from './hooks/useSocket';
import UsernameGate from './components/UsernameGate';
import Header from './components/Header';
import DropCard from './components/DropCard';

export default function App() {
  const user = useStore((s) => s.user);
  const drops = useStore((s) => s.drops);
  const loading = useStore((s) => s.loading);
  const setDrops = useStore((s) => s.setDrops);
  const [fatalError, setFatalError] = useState(null);

  // Socket connects regardless of gate state so the dashboard is already
  // live the moment a user signs in.
  useSocket();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { drops: fetched } = await api.listDrops();
        if (!cancelled) setDrops(fetched);
      } catch (err) {
        if (!cancelled) {
          setFatalError(err.message);
          toast.error('Could not load drops - is the API server running?');
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [setDrops]);

  if (!user) {
    return (
      <>
        <Toaster position="top-right" />
        <UsernameGate />
      </>
    );
  }

  return (
    <div className="min-h-screen">
      <Toaster position="top-right" />
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading && !fatalError && <p className="text-gray-500">Loading drops…</p>}
        {fatalError && (
          <div className="bg-red-950/50 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
            {fatalError}
          </div>
        )}
        {!loading && drops.length === 0 && !fatalError && (
          <p className="text-gray-500">No merch drops yet. Check back soon.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drops.map((drop) => (
            <DropCard key={drop.id} drop={drop} />
          ))}
        </div>
      </main>
    </div>
  );
}
