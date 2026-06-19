import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import socket from "../services/socket";
import { useBroadcaster } from "../hooks/useBroadcaster";
import ChatPanel from "../components/ChatPanel";
import ReactionOverlay from "../components/ReactionOverlay";
import PollCreator from "../components/PollCreator";

export default function GoLive() {
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const [stream, setStream] = useState(null); // { id, title, category }
  const [title, setTitle] = useState("My Live Stream");
  const [category, setCategory] = useState("Just Chatting");
  const [editingMeta, setEditingMeta] = useState(false);
  const [lastReaction, setLastReaction] = useState(null);
  const [activePoll, setActivePoll] = useState(null);
  const [error, setError] = useState("");

  const {
    localStream,
    cameraOn,
    screenOn,
    viewerCount,
    isLive,
    goLive,
    endLive,
    toggleCamera,
    toggleScreen
  } = useBroadcaster({ streamId: stream?.id });

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    function handleReaction(data) {
      setLastReaction({ ...data, _ts: Date.now() });
    }
    socket.on("reaction", handleReaction);
    return () => socket.off("reaction", handleReaction);
  }, []);

  async function handleStartSetup() {
    setError("");
    try {
      const res = await api.post("/stream", { title, category, mode: "webrtc" });
      setStream(res.data);
      goLive(res.data.id);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to start stream");
    }
  }

  async function handleEndStream() {
    if (!stream) return;
    try {
      await api.post(`/stream/${stream.id}/end`);
    } catch (err) {
      console.error(err);
    }
    endLive();
    navigate("/dashboard");
  }

  async function handleSaveMeta() {
    if (!stream) return;
    try {
      const res = await api.patch(`/stream/${stream.id}`, { title, category });
      socket.emit("stream-updated", res.data);
      setEditingMeta(false);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreatePoll({ question, options }) {
    if (!stream) return;
    try {
      const res = await api.post(`/polls/${stream.id}`, { question, options });
      setActivePoll(res.data);
      socket.emit("poll-started", res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleClosePoll() {
    if (!stream) return;
    try {
      await api.post(`/polls/${stream.id}/close`);
      setActivePoll(null);
      socket.emit("poll-closed");
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCameraClick() {
    try {
      await toggleCamera();
    } catch {
      setError("Camera permission denied. Check your browser settings.");
    }
  }

  async function handleScreenClick() {
    try {
      await toggleScreen();
    } catch {
      setError("Screen share was cancelled or isn't available.");
    }
  }

  const hasVideo = cameraOn || screenOn;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="relative bg-zinc-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
            {hasVideo ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <p className="text-gray-500">Turn on your camera or screen share to preview</p>
            )}

            <ReactionOverlay incoming={lastReaction} />

            {isLive && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="bg-red-600 text-xs font-bold px-2 py-1 rounded">LIVE</span>
                <span className="bg-black/60 text-xs px-2 py-1 rounded">{viewerCount} watching</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleCameraClick}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                cameraOn ? "bg-purple-600" : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              {cameraOn ? "📷 Camera On" : "📷 Turn On Camera"}
            </button>

            <button
              onClick={handleScreenClick}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                screenOn ? "bg-purple-600" : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              {screenOn ? "🖥️ Sharing Screen" : "🖥️ Share Screen"}
            </button>

            {!isLive ? (
              <button
                onClick={handleStartSetup}
                disabled={!hasVideo}
                className="px-6 py-2 rounded-lg text-sm font-semibold bg-red-600 disabled:bg-zinc-800 disabled:text-gray-500 ml-auto"
              >
                Go Live
              </button>
            ) : (
              <button
                onClick={handleEndStream}
                className="px-6 py-2 rounded-lg text-sm font-semibold bg-zinc-800 hover:bg-red-700 ml-auto"
              >
                End Stream
              </button>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="bg-zinc-900 p-4 rounded-xl">
            {editingMeta ? (
              <div className="space-y-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Stream title"
                  className="w-full p-2 rounded bg-zinc-800 text-sm"
                />
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category"
                  className="w-full p-2 rounded bg-zinc-800 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveMeta}
                    className="px-3 py-1.5 bg-purple-600 rounded text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingMeta(false)}
                    className="px-3 py-1.5 bg-zinc-800 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-gray-500">{category}</p>
                </div>
                <button
                  onClick={() => setEditingMeta(true)}
                  className="text-sm text-purple-400"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {stream && (
            <PollCreator
              onCreate={handleCreatePoll}
              activePoll={activePoll}
              onCloseActivePoll={handleClosePoll}
            />
          )}

          {stream && (
            <div className="text-sm text-gray-500">
              Share this link with viewers:{" "}
              <span className="text-purple-400">
                {window.location.origin}/stream/{stream.id}
              </span>
            </div>
          )}
        </div>

        <div className="h-[600px]">
          {stream ? (
            <ChatPanel streamId={stream.id} />
          ) : (
            <div className="bg-zinc-900 p-4 rounded-xl h-full flex items-center justify-center text-sm text-gray-500">
              Chat will appear once you go live
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
