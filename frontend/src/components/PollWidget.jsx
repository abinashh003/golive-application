export default function PollWidget({ poll, onVote, hasVoted }) {
  if (!poll) return null;

  const total = poll.counts.reduce((sum, c) => sum + c, 0);

  return (
    <div className="bg-zinc-900 p-4 rounded-xl">
      <p className="font-semibold mb-3">{poll.question}</p>

      <div className="space-y-2">
        {poll.options.map((option, idx) => {
          const count = poll.counts[idx] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isMine = poll.myVote === idx;

          return (
            <button
              key={idx}
              onClick={() => onVote(idx)}
              disabled={hasVoted}
              className={`w-full text-left relative overflow-hidden rounded-lg p-2 border transition-colors ${
                isMine ? "border-purple-500" : "border-zinc-700"
              } ${hasVoted ? "cursor-default" : "hover:border-purple-400 cursor-pointer"}`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-purple-600/30"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex justify-between text-sm">
                <span>{option}{isMine ? " ✓" : ""}</span>
                {hasVoted && <span>{pct}% ({count})</span>}
              </div>
            </button>
          );
        })}
      </div>

      {!hasVoted && <p className="text-xs text-gray-500 mt-2">Click an option to vote</p>}
    </div>
  );
}
