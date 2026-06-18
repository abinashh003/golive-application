import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl mb-2">Welcome, {user?.name}</h1>
      <p className="text-gray-500 mb-8">Manage your streams and go live with one click.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 p-6 rounded-xl">
          <p className="text-sm text-gray-500">Status</p>
          <p className="text-xl font-semibold mt-1">Offline</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-xl">
          <p className="text-sm text-gray-500">Last viewers</p>
          <p className="text-xl font-semibold mt-1">—</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-xl">
          <p className="text-sm text-gray-500">Followers</p>
          <p className="text-xl font-semibold mt-1">—</p>
        </div>
      </div>

      <Link to="/go-live">
        <button className="px-6 py-3 bg-red-600 rounded-xl font-semibold">
          Go Live
        </button>
      </Link>
    </div>
  );
}
