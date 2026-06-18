import { useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function FollowButton({ broadcasterId, initialFollowing, initialCount }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggleFollow() {
    if (!user) {
      alert("Log in to follow streamers");
      return;
    }

    setBusy(true);
    try {
      if (following) {
        const res = await api.delete(`/stream/follow/${broadcasterId}`);
        setFollowing(false);
        setCount(res.data.followerCount);
      } else {
        const res = await api.post(`/stream/follow/${broadcasterId}`);
        setFollowing(true);
        setCount(res.data.followerCount);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggleFollow}
      disabled={busy}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        following ? "bg-zinc-800 text-white" : "bg-purple-600 text-white hover:bg-purple-700"
      }`}
    >
      {following ? "Following" : "Follow"} · {count}
    </button>
  );
}
