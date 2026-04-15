const express = require("express");
const router = express.Router();
const ragController = require("../controllers/ragController");

// 上传pdf
router.post("/upload", ragController.upload, ragController.uploadPDF);

// 问答
router.post("/ask", ragController.ask);

module.exports = router;
