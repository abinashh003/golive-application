const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const streamRoutes = require("./routes/stream");
const chatRoutes = require("./routes/chat");
const pollRoutes = require("./routes/polls");
const socketHandler = require("./websocket/socketHandler");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*"
  }
});

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/polls", pollRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 5000;

// In a single-replica setup, REDIS_HOST can be left unset and Socket.IO
// falls back to its built-in in-memory adapter -- fine for local dev.
// In Kubernetes with multiple backend replicas, REDIS_HOST must be set so
// that WebRTC signaling (offer/answer/ICE), chat, reactions, and viewer
// counts are shared across all pods instead of being stuck per-pod.
async function start() {
  if (process.env.REDIS_HOST) {
    const redisUrl = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => console.error("Redis pub client error:", err.message));
    subClient.on("error", (err) => console.error("Redis sub client error:", err.message));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    console.log(`Socket.IO Redis adapter connected (${redisUrl})`);
  } else {
    console.log("REDIS_HOST not set -- using in-memory Socket.IO adapter (single replica only)");
  }

  // Socket event handlers are attached only once the adapter (if any) is
  // in place, so no connection is ever missed by it.
  socketHandler(io);

  server.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
