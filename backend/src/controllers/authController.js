const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/postgres");

const AVATAR_COLORS = ["#9333ea", "#dc2626", "#2563eb", "#16a34a", "#ea580c", "#0891b2"];

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE email=$1",
      [email]
    );

    if (existing.rows.length) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, avatar_color)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, avatar_color`,
      [name, email, hash, color]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET || "livestream-secret",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Signup successful",
      token,
      user: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatar_color }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET || "livestream-secret",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatar_color }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, avatar_color FROM users WHERE id=$1",
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];
    res.json({ id: user.id, name: user.name, email: user.email, avatarColor: user.avatar_color });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
