import { useState } from "react";

export default function PollCreator({ onCreate, onClose, activePoll, onCloseActivePoll }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  function updateOption(idx, value) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  function addOption() {
    if (options.length < 5) setOptions((prev) => [...prev, ""]);
  }

  function removeOption(idx) {
    if (options.length > 2) setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2) return;

    await onCreate({ question: question.trim(), options: cleanOptions });
    setQuestion("");
    setOptions(["", ""]);
    setOpen(false);
  }

  if (activePoll) {
    return (
      <div className="bg-zinc-900 p-4 rounded-xl">
        <p className="text-sm text-gray-400 mb-2">Poll is live</p>
        <p className="font-medium mb-3">{activePoll.question}</p>
        <button
          onClick={onCloseActivePoll}
          className="text-sm px-3 py-1.5 bg-red-600 rounded-lg"
        >
          End poll
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 bg-zinc-800 rounded-lg hover:bg-zinc-700"
      >
        + Start a poll
      </button>
    );
  }

  return (
    <div className="bg-zinc-900 p-4 rounded-xl space-y-2">
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask your viewers something..."
        className="w-full p-2 rounded bg-zinc-800 text-sm"
      />

      {options.map((opt, idx) => (
        <div key={idx} className="flex gap-2">
          <input
            value={opt}
            onChange={(e) => updateOption(idx, e.target.value)}
            placeholder={`Option ${idx + 1}`}
            className="flex-1 p-2 rounded bg-zinc-800 text-sm"
          />
          {options.length > 2 && (
            <button onClick={() => removeOption(idx)} className="text-gray-500 px-2">
              ✕
            </button>
          )}
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        {options.length < 5 && (
          <button onClick={addOption} className="text-xs text-purple-400">
            + Add option
          </button>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          className="flex-1 bg-purple-600 p-2 rounded text-sm"
        >
          Launch poll
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-2 bg-zinc-800 rounded text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
