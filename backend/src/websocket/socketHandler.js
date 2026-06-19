const pool = require("../db/postgres");
const { verifyToken } = require("../middleware/authMiddleware");
const { createClient } = require("redis");

// Room bookkeeping (who is broadcasting a given stream, which socket IDs
// are watching it) has to be visible to every backend pod, not just the
// pod a given socket happens to be connected to. With multiple replicas,
// a viewer's "join-stream" can land on pod A while the broadcaster's
// socket lives on pod B -- if this state were process-local (a plain Map),
// pod A would never find the broadcaster to signal.
//
// When REDIS_HOST is set, room state lives in Redis (shared by all pods).
// When it isn't set (local single-instance dev), we fall back to an
// in-memory Map with the same interface so nothing else has to change.
function createRoomStore() {
  if (!process.env.REDIS_HOST) {
    const rooms = new Map();

    function getRoom(streamId) {
      if (!rooms.has(streamId)) {
        rooms.set(streamId, { broadcasterSocketId: null, viewers: new Set() });
      }
      return rooms.get(streamId);
    }

    return {
      async setBroadcaster(streamId, socketId) {
        getRoom(streamId).broadcasterSocketId = socketId;
      },
      async clearBroadcaster(streamId, socketId) {
        const room = getRoom(streamId);
        if (room.broadcasterSocketId === socketId) room.broadcasterSocketId = null;
      },
      async getBroadcaster(streamId) {
        return getRoom(streamId).broadcasterSocketId;
      },
      async addViewer(streamId, socketId) {
        getRoom(streamId).viewers.add(socketId);
      },
      async removeViewer(streamId, socketId) {
        getRoom(streamId).viewers.delete(socketId);
      },
      async viewerCount(streamId) {
        return getRoom(streamId).viewers.size;
      },
      async isEmpty(streamId) {
        const room = getRoom(streamId);
        const empty = !room.broadcasterSocketId && room.viewers.size === 0;
        if (empty) rooms.delete(streamId);
        return empty;
      }
    };
  }

  // Redis-backed store, shared across all backend pods.
  const redisUrl = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
  const client = createClient({ url: redisUrl });
  client.on("error", (err) => console.error("Room store Redis error:", err.message));
  client.connect().catch((err) => console.error("Room store Redis connect failed:", err.message));

  const broadcasterKey = (streamId) => `room:${streamId}:broadcaster`;
  const viewersKey = (streamId) => `room:${streamId}:viewers`;

  return {
    async setBroadcaster(streamId, socketId) {
      await client.set(broadcasterKey(streamId), socketId);
    },
    async clearBroadcaster(streamId, socketId) {
      const current = await client.get(broadcasterKey(streamId));
      if (current === socketId) await client.del(broadcasterKey(streamId));
    },
    async getBroadcaster(streamId) {
      return client.get(broadcasterKey(streamId));
    },
    async addViewer(streamId, socketId) {
      await client.sAdd(viewersKey(streamId), socketId);
    },
    async removeViewer(streamId, socketId) {
      await client.sRem(viewersKey(streamId), socketId);
    },
    async viewerCount(streamId) {
      return client.sCard(viewersKey(streamId));
    },
    async isEmpty(streamId) {
      const [broadcaster, count] = await Promise.all([
        client.get(broadcasterKey(streamId)),
        client.sCard(viewersKey(streamId))
      ]);
      const empty = !broadcaster && count === 0;
      if (empty) {
        await Promise.all([client.del(broadcasterKey(streamId)), client.del(viewersKey(streamId))]);
      }
      return empty;
    }
  };
}

module.exports = function (io) {
  const roomStore = createRoomStore();

  io.on("connection", (socket) => {
    let identity = { id: null, name: "Guest", avatarColor: "#71717a" };
    let joinedStreamId = null;
    let role = null; // 'broadcaster' | 'viewer'

    // Client sends its JWT (if logged in) so chat/reactions can be attributed.
    socket.on("authenticate", (token) => {
      if (!token) return;
      try {
        const decoded = verifyToken(token);
        identity = { id: decoded.id, name: decoded.name, avatarColor: identity.avatarColor };
      } catch (err) {
        // ignore bad token, stay anonymous
      }
    });

    // ---------- Room join (both broadcaster and viewers call this) ----------
    socket.on("join-stream", async ({ streamId, asBroadcaster }) => {
      joinedStreamId = String(streamId);
      socket.join(`stream:${joinedStreamId}`);

      if (asBroadcaster) {
        role = "broadcaster";
        await roomStore.setBroadcaster(joinedStreamId, socket.id);
        socket.to(`stream:${joinedStreamId}`).emit("broadcaster-online");
      } else {
        role = "viewer";
        await roomStore.addViewer(joinedStreamId, socket.id);

        // Tell the broadcaster (wherever its socket/pod lives -- the
        // Redis adapter makes io.to() work across pods) a new viewer
        // wants a connection.
        const broadcasterSocketId = await roomStore.getBroadcaster(joinedStreamId);
        if (broadcasterSocketId) {
          io.to(broadcasterSocketId).emit("viewer-joined", { viewerId: socket.id });
        }
      }

      const count = await roomStore.viewerCount(joinedStreamId);
      io.to(`stream:${joinedStreamId}`).emit("viewer-count", count);
    });

    // ---------- WebRTC signaling relay ----------
    // Broadcaster -> specific viewer: SDP offer
    socket.on("webrtc-offer", ({ viewerId, sdp }) => {
      io.to(viewerId).emit("webrtc-offer", { sdp, broadcasterId: socket.id });
    });

    // Viewer -> broadcaster: SDP answer
    socket.on("webrtc-answer", ({ broadcasterId, sdp }) => {
      io.to(broadcasterId).emit("webrtc-answer", { sdp, viewerId: socket.id });
    });

    // Either side -> the other: ICE candidates
    socket.on("webrtc-ice-candidate", ({ targetId, candidate }) => {
      io.to(targetId).emit("webrtc-ice-candidate", { candidate, senderId: socket.id });
    });

    // ---------- Chat ----------
    socket.on("chat-message", (data) => {
      const { streamId, message } = data;
      if (!message || !message.trim()) return;
      const trimmed = message.slice(0, 500);

      // Broadcast immediately so live delivery never waits on, or depends on,
      // the database write succeeding.
      io.to(`stream:${streamId}`).emit("chat-message", {
        streamId,
        message: trimmed,
        senderName: identity.name,
        avatarColor: identity.avatarColor,
        createdAt: new Date().toISOString()
      });

      pool
        .query(`INSERT INTO messages (stream_id, user_id, message) VALUES ($1, $2, $3)`, [
          streamId,
          identity.id,
          trimmed
        ])
        .catch((err) => console.error("Chat save error:", err.message));
    });

    // ---------- Emoji reactions (fire-and-forget, lightly persisted) ----------
    socket.on("reaction", async ({ streamId, emoji }) => {
      const allowed = ["❤️", "😂", "🔥", "👏", "😮", "👍"];
      if (!allowed.includes(emoji)) return;

      io.to(`stream:${streamId}`).emit("reaction", { emoji, senderName: identity.name });

      try {
        await pool.query(
          `INSERT INTO reactions (stream_id, user_id, emoji) VALUES ($1, $2, $3)`,
          [streamId, identity.id, emoji]
        );
      } catch (err) {
        console.error("Reaction save error:", err.message);
      }
    });

    // ---------- Polls (broadcast new poll / closed poll to room) ----------
    socket.on("poll-started", (poll) => {
      if (joinedStreamId) {
        io.to(`stream:${joinedStreamId}`).emit("poll-started", poll);
      }
    });

    socket.on("poll-updated", (poll) => {
      if (joinedStreamId) {
        io.to(`stream:${joinedStreamId}`).emit("poll-updated", poll);
      }
    });

    socket.on("poll-closed", () => {
      if (joinedStreamId) {
        io.to(`stream:${joinedStreamId}`).emit("poll-closed");
      }
    });

    // ---------- Stream metadata updates (title/category edits go live instantly) ----------
    socket.on("stream-updated", (payload) => {
      if (joinedStreamId) {
        io.to(`stream:${joinedStreamId}`).emit("stream-updated", payload);
      }
    });

    // ---------- Broadcaster ends the stream ----------
    socket.on("stream-ended", () => {
      if (joinedStreamId) {
        io.to(`stream:${joinedStreamId}`).emit("stream-ended");
      }
    });

    // Shared cleanup used by both an explicit "leave-stream" (component
    // unmount, navigating away, switching streams) and an actual socket
    // disconnect (tab closed, network drop). Without this being callable
    // from both places, a viewer who navigates away without closing the
    // tab/socket would never be removed from the room -- the viewer count
    // would only ever go down when the whole browser tab closes.
    async function leaveCurrentStream() {
      if (!joinedStreamId) return;
      const leftStreamId = joinedStreamId;
      const wasBroadcaster = role === "broadcaster";

      if (wasBroadcaster) {
        await roomStore.clearBroadcaster(leftStreamId, socket.id);
        io.to(`stream:${leftStreamId}`).emit("broadcaster-offline");
      } else {
        await roomStore.removeViewer(leftStreamId, socket.id);
        const broadcasterSocketId = await roomStore.getBroadcaster(leftStreamId);
        if (broadcasterSocketId) {
          io.to(broadcasterSocketId).emit("viewer-left", { viewerId: socket.id });
        }
      }

      const count = await roomStore.viewerCount(leftStreamId);

      // Send the updated count to everyone still in the room, AND
      // explicitly to this socket too, since it's about to leave the
      // room and the broadcast above won't reach it after that.
      io.to(`stream:${leftStreamId}`).emit("viewer-count", count);
      socket.emit("viewer-count", count);

      socket.leave(`stream:${leftStreamId}`);
      await roomStore.isEmpty(leftStreamId);

      // Reset local state so this same socket can cleanly join a
      // different stream afterward (e.g. viewer browses to another
      // live stream without reloading the page).
      joinedStreamId = null;
      role = null;
    }

    // ---------- Explicit leave (called on component unmount / navigation) ----------
    socket.on("leave-stream", () => {
      leaveCurrentStream().catch((err) => console.error("leave-stream error:", err.message));
    });

    // ---------- Cleanup on actual disconnect (tab closed, network drop) ----------
    socket.on("disconnect", () => {
      leaveCurrentStream().catch((err) => console.error("disconnect cleanup error:", err.message));
    });
  });
};
