const router = require("express").Router();
const {
  createStream,
  endStream,
  updateStream,
  getStream,
  getMyStream,
  listLive
} = require("../controllers/streamController");
const { follow, unfollow } = require("../controllers/followController");
const { requireAuth, optionalAuth } = require("../middleware/authMiddleware");

router.get("/live", listLive);
router.get("/me", requireAuth, getMyStream);
router.post("/", requireAuth, createStream);
router.get("/:id", optionalAuth, getStream);
router.patch("/:id", requireAuth, updateStream);
router.post("/:id/end", requireAuth, endStream);

router.post("/follow/:broadcasterId", requireAuth, follow);
router.delete("/follow/:broadcasterId", requireAuth, unfollow);

module.exports = router;
