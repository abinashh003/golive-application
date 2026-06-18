const EMOJIS = ["❤️", "😂", "🔥", "👏", "😮", "👍"];

export default function ReactionBar({ onReact }) {
  return (
    <div className="flex gap-1.5 bg-zinc-900/80 backdrop-blur p-2 rounded-xl">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="text-xl hover:scale-125 transition-transform active:scale-95"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
