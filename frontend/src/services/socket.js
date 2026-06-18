import { io } from "socket.io-client";

const socketURL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const socket = io(socketURL, { autoConnect: true });

socket.on("connect", () => {
  const token = localStorage.getItem("token");
  if (token) {
    socket.emit("authenticate", token);
  }
});

export default socket;
