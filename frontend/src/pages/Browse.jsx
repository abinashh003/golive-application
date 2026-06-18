import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

export default function Browse() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/stream/live")
      .then((res) => setStreams(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Live Now</h1>

      {loading && <p className="text-gray-500">Loading streams...</p>}

      {!loading && streams.length === 0 && (
        <p className="text-gray-500">No one is live right now. Be the first!</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {streams.map((s) => (
          <Link
            key={s.id}
            to={`/stream/${s.id}`}
            className="bg-zinc-900 rounded-xl p-4 hover:bg-zinc-800 transition-colors"
          >
            <div className="aspect-video bg-zinc-800 rounded-lg mb-3 flex items-center justify-center text-xs text-red-500 font-bold">
              LIVE
            </div>
            <p className="font-medium">{s.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: s.avatarColor || "#9333ea" }}
              >
                {s.broadcasterName?.[0]?.toUpperCase()}
              </span>
              <p className="text-sm text-gray-500">{s.broadcasterName}</p>
            </div>
            <p className="text-xs text-gray-600 mt-1">{s.category}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
