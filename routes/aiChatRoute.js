const express = require("express");
const router = express.Router();
const {
  chat,
  chatStream,
  getHistory,
  delHistory,
  getAllChat,
  chatWithTools,
  chatWithToolsStream,
  chatAgentStream,
} = require("../controllers/aiChatController");

router.post("/", chat);
router.post("/stream", chatStream);
router.get("/getHistory", getHistory);
router.get("/delHistory/:sessionId", delHistory);
router.get("/getAllHistory", getAllChat);
router.post("/tools", chatWithTools);
router.post("/toolsStream", chatWithToolsStream);
router.post("/agentToolStream", chatAgentStream);

module.exports = router;
