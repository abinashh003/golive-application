import { useEffect, useRef, useState } from "react";

let idCounter = 0;

// Renders emojis that float up from the bottom and fade out, Twitch-Heart-style.
// Call the exposed `push` ref method whenever a reaction event arrives.
export default function ReactionOverlay({ incoming }) {
  const [floaters, setFloaters] = useState([]);

  useEffect(() => {
    if (!incoming) return;

    const id = idCounter++;
    const leftPercent = 10 + Math.random() * 70;
    const drift = (Math.random() - 0.5) * 60;

    setFloaters((prev) => [...prev, { id, emoji: incoming.emoji, left: leftPercent, drift }]);

    const timeout = setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== id));
    }, 2200);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {floaters.map((f) => (
        <span
          key={f.id}
          className="absolute bottom-10 text-4xl select-none"
          style={{
            left: `${f.left}%`,
            animation: "float-up 2.2s ease-out forwards",
            "--drift": `${f.drift}px`
          }}
        >
          {f.emoji}
        </span>
      ))}

      <style>{`
        @keyframes float-up {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
          15% { opacity: 1; transform: translate(0, -20px) scale(1); }
          100% { transform: translate(var(--drift), -320px) scale(1.1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
