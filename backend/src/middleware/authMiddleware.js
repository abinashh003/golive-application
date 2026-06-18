const jwt = require("jsonwebtoken");

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || "livestream-secret");
}

// Strict middleware: rejects requests without a valid token
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Soft middleware: attaches req.user if a valid token is present, but
// never blocks the request (useful for public routes that personalize
// when logged in, e.g. viewer counts, follow state)
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (token) {
    try {
      req.user = verifyToken(token);
    } catch (err) {
      // ignore invalid token, treat as anonymous
    }
  }
  next();
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.optionalAuth = optionalAuth;
module.exports.verifyToken = verifyToken;
