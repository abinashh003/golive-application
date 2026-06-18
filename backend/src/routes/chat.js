const router = require("express").Router();
const pool = require("../db/postgres");

router.get("/:streamId", async (req, res) => {
  try {
    const { streamId } = req.params;

    const result = await pool.query(
      `SELECT m.message, m.created_at, u.name AS sender_name, u.avatar_color
       FROM messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.stream_id = $1
       ORDER BY m.created_at ASC
       LIMIT 200`,
      [streamId]
    );

    res.json(result.rows.map((r) => ({
      message: r.message,
      senderName: r.sender_name || "Guest",
      avatarColor: r.avatar_color || "#71717a",
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load chat" });
  }
});

module.exports = router;
