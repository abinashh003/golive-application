import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import socket from "../services/socket";
import ChatPanel from "../components/ChatPanel";
import LivePlayer from "../components/LivePlayer";
import ReactionBar from "../components/ReactionBar";
import PollWidget from "../components/PollWidget";
import FollowButton from "../components/FollowButton";

export default function StreamPage() {
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [lastReaction, setLastReaction] = useState(null);
  const [poll, setPoll] = useState(null);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    async function loadInfo() {
      try {
        const res = await api.get(`/stream/${id}`);
        setInfo(res.data);
      } catch (err) {
        console.error("Failed to load stream info", err);
      }
    }

    async function loadPoll() {
      try {
        const res = await api.get(`/polls/${id}/active`);
        setPoll(res.data);
      } catch (err) {
        console.error("Failed to load poll", err);
      }
    }

    loadInfo();
    loadPoll();

    function handleReaction(data) {
      setLastReaction({ ...data, _ts: Date.now() });
    }

    function handlePollStarted(p) {
      setPoll(p);
    }

    function handlePollUpdated(p) {
      setPoll((prev) => (prev ? { ...prev, counts: p.counts } : prev));
    }

    function handlePollClosed() {
      setPoll(null);
    }

    function handleStreamUpdated(payload) {
      setInfo((prev) => (prev ? { ...prev, ...payload } : prev));
    }

    function handleStreamEnded() {
      setEnded(true);
    }

    socket.on("reaction", handleReaction);
    socket.on("poll-started", handlePollStarted);
    socket.on("poll-updated", handlePollUpdated);
    socket.on("poll-closed", handlePollClosed);
    socket.on("stream-updated", handleStreamUpdated);
    socket.on("stream-ended", handleStreamEnded);

    return () => {
      socket.off("reaction", handleReaction);
      socket.off("poll-started", handlePollStarted);
      socket.off("poll-updated", handlePollUpdated);
      socket.off("poll-closed", handlePollClosed);
      socket.off("stream-updated", handleStreamUpdated);
      socket.off("stream-ended", handleStreamEnded);
    };
  }, [id]);

  function sendReaction(emoji) {
    socket.emit("reaction", { streamId: id, emoji });
  }

  async function castVote(optionIdx) {
    if (!poll) return;
    try {
      const res = await api.post(`/polls/vote/${poll.id}`, { optionIdx });
      const updated = { ...poll, counts: res.data.counts, myVote: res.data.myVote };
      setPoll(updated);
      socket.emit("poll-updated", updated);
    } catch (err) {
      console.error(err);
    }
  }

  if (!info) {
    return <div className="min-h-screen bg-black text-white p-6">Loading stream...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <LivePlayer streamId={id} mode={info.mode} lastReaction={lastReaction} />

          {ended && (
            <p className="text-sm text-gray-500">This stream has ended.</p>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{info.title}</h1>
              <p className="text-sm text-gray-500">
                {info.broadcasterName} · {info.category}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <FollowButton
                broadcasterId={info.broadcasterId}
                initialFollowing={info.isFollowing}
                initialCount={info.followerCount}
              />
              <ReactionBar onReact={sendReaction} />
            </div>
          </div>

          {poll && <PollWidget poll={poll} onVote={castVote} hasVoted={poll.myVote !== null} />}
        </div>

        <div className="h-[600px]">
          <ChatPanel streamId={id} />
        </div>
      </div>
    </div>
  );
}
