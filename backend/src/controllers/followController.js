const pool = require("../db/postgres");

exports.follow = async (req, res) => {
  try {
    const followerId = req.user.id;
    const broadcasterId = parseInt(req.params.broadcasterId, 10);

    if (followerId === broadcasterId) {
      return res.status(400).json({ error: "You can't follow yourself" });
    }

    await pool.query(
      `INSERT INTO follows (follower_id, broadcaster_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, broadcaster_id) DO NOTHING`,
      [followerId, broadcasterId]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM follows WHERE broadcaster_id = $1`,
      [broadcasterId]
    );

    res.json({ following: true, followerCount: countResult.rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to follow" });
  }
};

exports.unfollow = async (req, res) => {
  try {
    const followerId = req.user.id;
    const broadcasterId = parseInt(req.params.broadcasterId, 10);

    await pool.query(
      `DELETE FROM follows WHERE follower_id = $1 AND broadcaster_id = $2`,
      [followerId, broadcasterId]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM follows WHERE broadcaster_id = $1`,
      [broadcasterId]
    );

    res.json({ following: false, followerCount: countResult.rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unfollow" });
  }
};
