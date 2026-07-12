import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useStore } from '../store/useStore';

export default function UsernameGate() {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useStore((s) => s.setUser);

  async function handleSubmit(e) {
    e.preventDefault();
    if (value.trim().length < 2) {
      toast.error('Username must be at least 2 characters.');
      return;
    }
    setLoading(true);
    try {
      const { user } = await api.identify(value.trim());
      setUser(user);
      toast.success(`Welcome, ${user.username}!`);
    } catch (err) {
      toast.error(err.message || 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl"
      >
        <h1 className="text-xl font-bold mb-1">Sneaker Drop</h1>
        <p className="text-gray-400 text-sm mb-4">
          Pick a display name to reserve and purchase items.
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. sneakerhead_99"
          maxLength={32}
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 mb-4 outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed py-2 font-semibold transition-colors"
        >
          {loading ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
