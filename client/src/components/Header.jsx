import { useStore } from '../store/useStore';

export default function Header() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);

  return (
    <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-bold">Sneaker Drop</h1>
        <p className="text-xs text-gray-500">Real-time inventory dashboard</p>
      </div>
      {user && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-400">
            Signed in as <span className="text-gray-100 font-medium">{user.username}</span>
          </span>
          <button onClick={logout} className="text-gray-500 hover:text-gray-300 underline">
            switch user
          </button>
        </div>
      )}
    </header>
  );
}
