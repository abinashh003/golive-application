import { useCallback, useEffect, useRef, useState } from "react";
import socket from "../services/socket";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject"
  }
];

// Manages the broadcaster's local media (camera and/or screen share) and
// fans it out to every connected viewer via one RTCPeerConnection each.
// The signaling server only relays SDP/ICE; media flows browser-to-browser.
export function useBroadcaster({ streamId }) {
  const [localStream, setLocalStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [isLive, setIsLive] = useState(false);

  const peersRef = useRef(new Map()); // viewerId -> RTCPeerConnection
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const composedStreamRef = useRef(null);

  // Rebuild the single outbound MediaStream from whichever sources are active.
  // Screen share video takes priority if both are on; camera audio always included.
  const recomposeStream = useCallback(() => {
    const tracks = [];
    const videoSource = screenStreamRef.current || cameraStreamRef.current;

    if (videoSource) {
      const videoTrack = videoSource.getVideoTracks()[0];
      if (videoTrack) tracks.push(videoTrack);
    }

    const audioSource = cameraStreamRef.current || screenStreamRef.current;
    if (audioSource) {
      const audioTrack = audioSource.getAudioTracks()[0];
      if (audioTrack) tracks.push(audioTrack);
    }

    const newStream = new MediaStream(tracks);
    composedStreamRef.current = newStream;
    setLocalStream(newStream);

    // Replace the outgoing video/audio track on every existing peer connection
    // without renegotiating the whole connection.
    peersRef.current.forEach((pc) => {
      const senders = pc.getSenders();
      tracks.forEach((track) => {
        const sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          pc.addTrack(track, newStream);
        }
      });
    });

    return newStream;
  }, []);

  const createPeerForViewer = useCallback((viewerId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    if (composedStreamRef.current) {
      composedStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, composedStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc-ice-candidate", {
          targetId: viewerId,
          candidate: event.candidate
        });
      }
    };

    peersRef.current.set(viewerId, pc);
    return pc;
  }, []);

  const sendOfferToViewer = useCallback(async (viewerId) => {
    const pc = createPeerForViewer(viewerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc-offer", { viewerId, sdp: pc.localDescription });
  }, [createPeerForViewer]);

  useEffect(() => {
    function handleViewerJoined({ viewerId }) {
      sendOfferToViewer(viewerId);
    }

    function handleAnswer({ viewerId, sdp }) {
      const pc = peersRef.current.get(viewerId);
      if (pc) pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }

    function handleIce({ senderId, candidate }) {
      const pc = peersRef.current.get(senderId);
      if (pc && candidate) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }

    function handleViewerLeft({ viewerId }) {
      const pc = peersRef.current.get(viewerId);
      if (pc) pc.close();
      peersRef.current.delete(viewerId);
    }

    function handleViewerCount(count) {
      setViewerCount(count);
    }

    socket.on("viewer-joined", handleViewerJoined);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-ice-candidate", handleIce);
    socket.on("viewer-left", handleViewerLeft);
    socket.on("viewer-count", handleViewerCount);

    return () => {
      socket.off("viewer-joined", handleViewerJoined);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("webrtc-ice-candidate", handleIce);
      socket.off("viewer-left", handleViewerLeft);
      socket.off("viewer-count", handleViewerCount);
    };
  }, [sendOfferToViewer]);

  const goLive = useCallback((explicitStreamId) => {
    const idToUse = explicitStreamId ?? streamId;
    socket.emit("join-stream", { streamId: idToUse, asBroadcaster: true });
    setIsLive(true);
  }, [streamId]);

  const endLive = useCallback(() => {
    socket.emit("stream-ended");
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();

    [cameraStreamRef, screenStreamRef].forEach((ref) => {
      if (ref.current) {
        ref.current.getTracks().forEach((t) => t.stop());
        ref.current = null;
      }
    });

    setLocalStream(null);
    setCameraOn(false);
    setScreenOn(false);
    setIsLive(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
      setCameraOn(false);
      recomposeStream();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      cameraStreamRef.current = stream;
      setCameraOn(true);
      recomposeStream();
    } catch (err) {
      console.error("Camera permission denied or unavailable:", err);
      throw err;
    }
  }, [recomposeStream]);

  const toggleScreen = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenOn(false);
      recomposeStream();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // If the user stops sharing via the browser's native "Stop sharing" UI
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        screenStreamRef.current = null;
        setScreenOn(false);
        recomposeStream();
      });

      screenStreamRef.current = stream;
      setScreenOn(true);
      recomposeStream();
    } catch (err) {
      console.error("Screen share cancelled or unavailable:", err);
      throw err;
    }
  }, [recomposeStream]);

  useEffect(() => {
    return () => {
      peersRef.current.forEach((pc) => pc.close());
      [cameraStreamRef, screenStreamRef].forEach((ref) => {
        if (ref.current) ref.current.getTracks().forEach((t) => t.stop());
      });
    };
  }, []);

  return {
    localStream,
    cameraOn,
    screenOn,
    viewerCount,
    isLive,
    goLive,
    endLive,
    toggleCamera,
    toggleScreen
  };
}
