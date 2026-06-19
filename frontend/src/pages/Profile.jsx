import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-md mx-auto bg-zinc-900 rounded-xl p-8 text-center">
        <div
          className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold"
          style={{ backgroundColor: user.avatarColor || "#9333ea" }}
        >
          {user.name?.[0]?.toUpperCase()}
        </div>

        <h1 className="text-2xl font-semibold">{user.name}</h1>
        <p className="text-gray-500 mb-6">{user.email}</p>

        <Link to="/dashboard">
          <button className="px-6 py-2.5 bg-purple-600 rounded-lg font-medium">
            Go to Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}
