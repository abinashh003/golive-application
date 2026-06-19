import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="bg-zinc-900 px-6 py-4 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold tracking-tight">
        Live<span className="text-purple-500">Stream</span>
      </Link>

      <div className="flex items-center gap-4 text-sm">
        <Link to="/browse" className="text-gray-300 hover:text-white">
          Browse
        </Link>

        {user ? (
          <>
            <Link to="/go-live" className="text-gray-300 hover:text-white">
              Go Live
            </Link>
            <Link to="/dashboard" className="text-gray-300 hover:text-white">
              Dashboard
            </Link>
            <Link to="/profile">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold hover:opacity-80 cursor-pointer"
                style={{ backgroundColor: user.avatarColor || "#9333ea" }}
                title={user.name}
              >
                {user.name?.[0]?.toUpperCase()}
              </span>
            </Link>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-gray-300 hover:text-white">
              Login
            </Link>
            <Link to="/signup">
              <button className="bg-purple-600 px-4 py-1.5 rounded-lg">Sign up</button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
