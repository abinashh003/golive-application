import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-black text-white p-10 flex flex-col items-center justify-center text-center">
      <h1 className="text-5xl font-bold mb-6">
        Live<span className="text-purple-500">Stream</span>
      </h1>
      <p className="text-gray-400 mb-8 max-w-md">
        Go live straight from your browser with your camera, your screen, or both.
        Chat, react, and run polls with your audience in real time.
      </p>

      <div className="flex gap-4">
        {user ? (
          <>
            <Link to="/go-live">
              <button className="bg-red-600 px-6 py-3 rounded-xl font-semibold">
                Go Live
              </button>
            </Link>
            <Link to="/browse">
              <button className="bg-zinc-800 px-6 py-3 rounded-xl">
                Browse Streams
              </button>
            </Link>
          </>
        ) : (
          <>
            <Link to="/login">
              <button className="bg-purple-600 px-6 py-3 rounded-xl">Login</button>
            </Link>
            <Link to="/signup">
              <button className="bg-red-600 px-6 py-3 rounded-xl">Sign up</button>
            </Link>
            <Link to="/browse">
              <button className="bg-zinc-800 px-6 py-3 rounded-xl">Browse Streams</button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
