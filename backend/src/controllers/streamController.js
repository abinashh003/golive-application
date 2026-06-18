const crypto = require("crypto");
const pool = require("../db/postgres");

// Create (or reuse) this user's stream record and mark it live.
exports.createStream = async (req, res) => {
  try {
    const userId = req.user.id;
    const title = (req.body.title || "Untitled Stream").slice(0, 255);
    const category = (req.body.category || "Just Chatting").slice(0, 100);
    const mode = req.body.mode === "rtmp" ? "rtmp" : "webrtc";

    // Reuse an existing non-live stream row for this user if present,
    // otherwise create a fresh one with a new stream key.
    const existing = await pool.query(
      `SELECT id FROM streams WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    let stream;

    if (existing.rows.length) {
      const result = await pool.query(
        `UPDATE streams
         SET is_live = true, title = $2, category = $3, mode = $4,
             started_at = NOW(), ended_at = NULL
         WHERE id = $1
         RETURNING id, stream_key, title, category, mode`,
        [existing.rows[0].id, title, category, mode]
      );
      stream = result.rows[0];
    } else {
      const streamKey = crypto.randomBytes(16).toString("hex");
      const result = await pool.query(
        `INSERT INTO streams (user_id, stream_key, title, category, mode, is_live, started_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW())
         RETURNING id, stream_key, title, category, mode`,
        [userId, streamKey, title, category, mode]
      );
      stream = result.rows[0];
    }

    res.json({
      id: stream.id,
      streamKey: stream.stream_key,
      title: stream.title,
      category: stream.category,
      mode: stream.mode,
      rtmpUrl: "rtmp://localhost:1935/live" // only relevant if mode === 'rtmp'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create stream" });
  }
};

exports.endStream = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE streams SET is_live = false, ended_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Stream not found" });
    }

    res.json({ message: "Stream ended" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to end stream" });
  }
};

exports.updateStream = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, category } = req.body;

    const result = await pool.query(
      `UPDATE streams
       SET title = COALESCE($3, title), category = COALESCE($4, category)
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, category`,
      [id, userId, title || null, category || null]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Stream not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update stream" });
  }
};

exports.getStream = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT s.id, s.stream_key, s.title, s.category, s.is_live, s.mode,
              s.user_id, u.name AS broadcaster_name, u.avatar_color
       FROM streams s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Stream not found" });
    }

    const stream = result.rows[0];

    const followerCount = await pool.query(
      `SELECT COUNT(*)::int AS count FROM follows WHERE broadcaster_id = $1`,
      [stream.user_id]
    );

    let isFollowing = false;
    if (req.user) {
      const f = await pool.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND broadcaster_id = $2`,
        [req.user.id, stream.user_id]
      );
      isFollowing = f.rows.length > 0;
    }

    res.json({
      id: stream.id,
      title: stream.title,
      category: stream.category,
      isLive: stream.is_live,
      mode: stream.mode,
      streamKey: stream.stream_key,
      playbackUrl: `/hls/${stream.stream_key}.m3u8`,
      broadcasterId: stream.user_id,
      broadcasterName: stream.broadcaster_name,
      avatarColor: stream.avatar_color,
      followerCount: followerCount.rows[0].count,
      isFollowing
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stream" });
  }
};

// List currently live streams, for a "browse" view.
exports.listLive = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.title, s.category, s.mode, u.name AS broadcaster_name, u.avatar_color
       FROM streams s
       JOIN users u ON u.id = s.user_id
       WHERE s.is_live = true
       ORDER BY s.started_at DESC`
    );

    res.json(result.rows.map((s) => ({
      id: s.id,
      title: s.title,
      category: s.category,
      mode: s.mode,
      broadcasterName: s.broadcaster_name,
      avatarColor: s.avatar_color
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list streams" });
  }
};
