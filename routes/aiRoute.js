const express = require("express");
const router = express.Router();
const { chat, chatStream } = require("../controllers/aiController");
router.post("/", chat);
router.post("/stream", chatStream);
module.exports = router;
