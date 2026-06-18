const router = require("express").Router();
const pool = require("../db/postgres");
const { requireAuth, optionalAuth } = require("../middleware/authMiddleware");

// Get the active poll for a stream (if any), with live vote counts
router.get("/:streamId/active", optionalAuth, async (req, res) => {
  try {
    const { streamId } = req.params;

    const pollResult = await pool.query(
      `SELECT id, question, options, created_at
       FROM polls
       WHERE stream_id = $1 AND is_active = true
       ORDER BY created_at DESC LIMIT 1`,
      [streamId]
    );

    if (!pollResult.rows.length) {
      return res.json(null);
    }

    const poll = pollResult.rows[0];

    const voteResult = await pool.query(
      `SELECT option_idx, COUNT(*)::int AS count
       FROM poll_votes WHERE poll_id = $1
       GROUP BY option_idx`,
      [poll.id]
    );

    const counts = poll.options.map((_, idx) => {
      const row = voteResult.rows.find((r) => r.option_idx === idx);
      return row ? row.count : 0;
    });

    let myVote = null;
    if (req.user) {
      const mine = await pool.query(
        `SELECT option_idx FROM poll_votes WHERE poll_id = $1 AND user_id = $2`,
        [poll.id, req.user.id]
      );
      if (mine.rows.length) myVote = mine.rows[0].option_idx;
    }

    res.json({
      id: poll.id,
      question: poll.question,
      options: poll.options,
      counts,
      myVote
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load poll" });
  }
});

// Create a new poll (broadcaster only, enforced by stream ownership check)
router.post("/:streamId", requireAuth, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { question, options } = req.body;

    if (!question || !Array.isArray(options) || options.length < 2 || options.length > 5) {
      return res.status(400).json({ error: "Poll needs a question and 2-5 options" });
    }

    const ownerCheck = await pool.query(
      `SELECT id FROM streams WHERE id = $1 AND user_id = $2`,
      [streamId, req.user.id]
    );

    if (!ownerCheck.rows.length) {
      return res.status(403).json({ error: "Only the broadcaster can start a poll" });
    }

    await pool.query(
      `UPDATE polls SET is_active = false, closed_at = NOW()
       WHERE stream_id = $1 AND is_active = true`,
      [streamId]
    );

    const result = await pool.query(
      `INSERT INTO polls (stream_id, question, options, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, question, options`,
      [streamId, question.slice(0, 255), JSON.stringify(options.slice(0, 5).map((o) => String(o).slice(0, 80)))]
    );

    const poll = result.rows[0];

    res.json({
      id: poll.id,
      question: poll.question,
      options: poll.options,
      counts: poll.options.map(() => 0),
      myVote: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create poll" });
  }
});

// Vote on a poll
router.post("/vote/:pollId", requireAuth, async (req, res) => {
  try {
    const { pollId } = req.params;
    const { optionIdx } = req.body;

    const pollResult = await pool.query(
      `SELECT options FROM polls WHERE id = $1 AND is_active = true`,
      [pollId]
    );

    if (!pollResult.rows.length) {
      return res.status(404).json({ error: "Poll not found or closed" });
    }

    if (optionIdx < 0 || optionIdx >= pollResult.rows[0].options.length) {
      return res.status(400).json({ error: "Invalid option" });
    }

    await pool.query(
      `INSERT INTO poll_votes (poll_id, user_id, option_idx)
       VALUES ($1, $2, $3)
       ON CONFLICT (poll_id, user_id) DO UPDATE SET option_idx = $3`,
      [pollId, req.user.id, optionIdx]
    );

    const voteResult = await pool.query(
      `SELECT option_idx, COUNT(*)::int AS count
       FROM poll_votes WHERE poll_id = $1
       GROUP BY option_idx`,
      [pollId]
    );

    const counts = pollResult.rows[0].options.map((_, idx) => {
      const row = voteResult.rows.find((r) => r.option_idx === idx);
      return row ? row.count : 0;
    });

    res.json({ counts, myVote: optionIdx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to vote" });
  }
});

// Close the active poll (broadcaster only)
router.post("/:streamId/close", requireAuth, async (req, res) => {
  try {
    const { streamId } = req.params;

    const ownerCheck = await pool.query(
      `SELECT id FROM streams WHERE id = $1 AND user_id = $2`,
      [streamId, req.user.id]
    );

    if (!ownerCheck.rows.length) {
      return res.status(403).json({ error: "Only the broadcaster can close a poll" });
    }

    await pool.query(
      `UPDATE polls SET is_active = false, closed_at = NOW()
       WHERE stream_id = $1 AND is_active = true`,
      [streamId]
    );

    res.json({ message: "Poll closed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to close poll" });
  }
});

module.exports = router;
