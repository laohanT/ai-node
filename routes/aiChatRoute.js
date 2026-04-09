const express = require("express");
const router = express.Router();
const {
  chat,
  chatStream,
  getHistory,
  delHistory,
  getAllChat,
} = require("../controllers/aiChatController");

router.post("/", chat);
router.post("/stream", chatStream);
router.get("/getHistory", getHistory);
router.get("/delHistory/:sessionId", delHistory);
router.get("/getAllHistory", getAllChat);

module.exports = router;
