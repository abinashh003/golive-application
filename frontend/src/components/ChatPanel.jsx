import { useEffect, useRef, useState } from "react";
import socket from "../services/socket";
import api from "../services/api";

export default function ChatPanel({ streamId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await api.get(`/chat/${streamId}`);
        setMessages(res.data);
      } catch (err) {
        console.error("Failed to load chat history");
      }
    }

    loadMessages();

    function handleMessage(data) {
      if (String(data.streamId) === String(streamId)) {
        setMessages((prev) => [...prev, data]);
      }
    }

    socket.on("chat-message", handleMessage);
    return () => socket.off("chat-message", handleMessage);
  }, [streamId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function sendMessage() {
    if (!input.trim()) return;
    socket.emit("chat-message", { streamId, message: input });
    setInput("");
  }

  return (
    <div className="bg-zinc-900 p-4 rounded-xl h-full flex flex-col">
      <p className="font-semibold mb-2 text-sm text-gray-400">Live Chat</p>

      <div ref={scrollRef} className="flex-1 overflow-auto mb-4 space-y-1.5 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className="text-sm leading-snug">
            <span style={{ color: msg.avatarColor || "#a78bfa" }} className="font-medium">
              {msg.senderName || "Guest"}:
            </span>{" "}
            <span className="text-gray-200">{msg.message}</span>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-xs text-gray-600">No messages yet. Say something!</p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 p-2 rounded bg-zinc-800 text-sm"
          value={input}
          placeholder="Send a message"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          className="px-3 py-2 bg-purple-600 rounded text-sm"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
}
