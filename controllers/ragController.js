// 控制器负责处理http请求，调用service层
// 处理前端上传的文件
const multer = require("multer");
const ragServices = require("../services/ragServices");
// 配置multer内存存储（不写入磁盘）
const upload = multer({ storage: multer.memoryStorage() });

// 上传pdf接口
const uploadPDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "请上传PDF文件" });
    }
    const chunkCount = await ragServices.addDocument(req.file.buffer, true);
    res.json({
      status: 200,
      message: `文档已处理，共生成${chunkCount}个文本块`,
      chunkCount,
    });
  } catch (error) {
    console.log(error.message, "上传错误");
    res.status(500).json({ message: error.message || " 上传异常" });
  }
};

// 问答接口
const ask = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "请提供问题" });
    }
    // 1. 检索相关文档块，切块后的文档
    const relevantChunks = await ragServices.retrieve(question, 3);
    if (relevantChunks.length === 0) {
      return res.json({
        answer: "当前没有上传任何文档，请先上传 PDF。",
        sources: [],
      });
    }
    // 2.生成回答
    const answer = await ragServices.generateAnswer(question, relevantChunks);
    res.json({
      status: 200,
      answer,
      sources: relevantChunks, //返回原文片段，用于展示
    });
  } catch (error) {
    console.log("问答错误", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  upload: upload.single("file"), // 导出 multer 中间件
  uploadPDF,
  ask,
};
