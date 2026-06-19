import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import api from "../services/api";
import { useViewer } from "../hooks/useViewer";
import ReactionOverlay from "./ReactionOverlay";

export default function LivePlayer({ streamId, mode, lastReaction }) {
  const videoRef = useRef(null);
  const [hlsError, setHlsError] = useState(false);

  const { remoteStream, broadcasterOnline } = useViewer({
    streamId: mode === "webrtc" ? streamId : null
  });

  // WebRTC path: attach the remote MediaStream directly to the <video> element.
  useEffect(() => {
    if (mode === "webrtc" && videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [mode, remoteStream]);

  // Legacy RTMP/HLS path: load an .m3u8 playlist via hls.js for OBS-style broadcasts.
  useEffect(() => {
    if (mode !== "rtmp") return;

    let hls;

    async function loadStream() {
      try {
        const res = await api.get(`/stream/${streamId}`);
        const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace("/api", "");
        const streamUrl = `${apiBase.replace(":5000", ":8080")}${res.data.playbackUrl}`;

        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(streamUrl);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.ERROR, () => setHlsError(true));
        } else if (videoRef.current?.canPlayType("application/vnd.apple.mpegurl")) {
          videoRef.current.src = streamUrl;
        }
      } catch (err) {
        setHlsError(true);
      }
    }

    loadStream();
    return () => hls && hls.destroy();
  }, [mode, streamId]);

  const showOfflineState = mode === "webrtc" && broadcasterOnline === false;

  return (
    <div className="relative w-full bg-black rounded-xl overflow-hidden aspect-video">
      <video
        ref={videoRef}
        controls
        autoPlay
        muted
        playsInline
        className="w-full h-full object-contain bg-black"
      />

      {showOfflineState && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-gray-400">
          Stream is offline
        </div>
      )}

      {mode === "rtmp" && hlsError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-gray-400 text-sm px-6 text-center">
          Couldn't load the stream. Make sure the encoder (e.g. OBS) is pushing to the RTMP URL.
        </div>
      )}

      <ReactionOverlay incoming={lastReaction} />
    </div>
  );
}
