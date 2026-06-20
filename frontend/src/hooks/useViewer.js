import { useEffect, useRef, useState } from "react";
import socket from "../services/socket";

const ICE_SERVERS = [
  {
    urls: "stun:44.208.35.20:3478"
  },
  {
    urls: [
      "turn:44.208.35.20:3478?transport=udp",
      "turn:44.208.35.20:3478?transport=tcp"
    ],
    username: "test",
    credential: "test123"
  }
];

// Connects this viewer to the broadcaster's peer connection and exposes
// the incoming MediaStream once tracks arrive.
export function useViewer({ streamId }) {
  const [remoteStream, setRemoteStream] = useState(null);
  const [broadcasterOnline, setBroadcasterOnline] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const pcRef = useRef(null);

  useEffect(() => {
    if (!streamId) return;

    function createPeer(broadcasterId) {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onconnectionstatechange = () => {
        console.log("VIEWER STATE:", pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("VIEWER ICE:", pc.iceConnectionState);
      };

      pcRef.current = pc;

      // THIS WAS MISSING
      pc.ontrack = (event) => {
        console.log("TRACK RECEIVED");
        console.log("Streams:", event.streams);
        console.log("Tracks:", event.streams[0]?.getTracks());

        setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc-ice-candidate", {
            targetId: broadcasterId,
            candidate: event.candidate
          });
        }
      };

      return pc;
    }

    async function handleOffer({ sdp, broadcasterId }) {
      console.log("OFFER RECEIVED");

      const pc = createPeer(broadcasterId);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc-answer", {
        broadcasterId,
        sdp: pc.localDescription
      });

      setBroadcasterOnline(true);
    }

    function handleIce({ senderId, candidate }) {
      if (pcRef.current && candidate) {
        pcRef.current
          .addIceCandidate(new RTCIceCandidate(candidate))
          .catch(() => {});
      }
    }

    function handleBroadcasterOffline() {
      setBroadcasterOnline(false);
      setRemoteStream(null);

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    }

    function handleBroadcasterOnline() {
      setBroadcasterOnline(true);
    }

    function handleViewerCount(count) {
      setViewerCount(count);
    }

    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-ice-candidate", handleIce);
    socket.on("broadcaster-offline", handleBroadcasterOffline);
    socket.on("broadcaster-online", handleBroadcasterOnline);
    socket.on("viewer-count", handleViewerCount);

    socket.emit("join-stream", { streamId, asBroadcaster: false });

    return () => {
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-ice-candidate", handleIce);
      socket.off("broadcaster-offline", handleBroadcasterOffline);
      socket.off("broadcaster-online", handleBroadcasterOnline);
      socket.off("viewer-count", handleViewerCount);

      socket.emit("leave-stream");

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [streamId]);

  return { remoteStream, broadcasterOnline, viewerCount };
}