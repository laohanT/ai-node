// EdgeOne Pages Node Functions - Express 入口
// 所有路由在此文件中集中管理
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ============ TODO Routes ============
// 内存数据存储
let todoList = [
  { id: 1, todoName: "吃饭" },
  { id: 2, todoName: "铲猫砂" },
  { id: 3, todoName: "遛狗" },
  { id: 4, todoName: "买菜" },
  { id: 5, todoName: "做饭" },
];

app.get("/todos", (_req, res) => {
  res.json({ status: 200, data: todoList });
});

app.post("/todos", (req, res) => {
  const { todoName = "" } = req.body;
  const id = todoList.length + 1;
  todoList.push({ todoName, id });
  res.json({ status: 201, data: { todoName, id } });
});

app.put("/todos/:id", (req, res) => {
  const { id } = req.params;
  todoList.forEach((item) => {
    if (item.id == id) item.complete = true;
  });
  res.status(200).json({ data: todoList.find((item) => item.id == id) });
});

app.delete("/todos/:id", (req, res) => {
  const { id } = req.params;
  const index = todoList.findIndex((item) => item.id == id);
  if (index === -1) return res.status(404).json({ message: "资源未找到" });
  todoList.splice(index, 1);
  res.status(204).send();
});

// ============ AI Chat Routes ============
import axios from "axios";

const AI_URL = process.env.AI_URL;
const AI_SK_KEY = process.env.AI_SK_KEY;

// 非流式聊天
app.post("/chat", async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages))
      return res.status(400).json({ message: "参数必须是非空数组!" });

    const result = await axios.post(AI_URL, {
      model: "qwen-plus",
      messages,
      stream: false,
    }, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_SK_KEY}`,
      },
      timeout: 30000,
    });

    res.json({ status: 200, data: result.data.choices[0].message.content });
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json({ error: error.response.data });
    }
    next(error);
  }
});

// 流式聊天
app.post("/chat/stream", async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages 字段必须是非空数组" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const result = await axios({
      method: "post",
      url: AI_URL,
      data: { model: "qwen-plus", messages, stream: true },
      headers: {
        Authorization: `Bearer ${AI_SK_KEY}`,
        "Content-Type": "application/json",
      },
      responseType: "stream",
      timeout: 60000,
    });

    let buffer = "";
    result.data.on("data", (chunk) => {
      const chunkstr = chunk.toString();
      buffer += chunkstr;
      let lines = buffer.split(/\n/);
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || "";
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      }
    });

    result.data.on("end", () => res.end());
    result.data.on("error", (err) => {
      console.error("流式接收错误:", err);
      res.write(`data: ${JSON.stringify({ error: "AI 服务中断" })}\n\n`);
      res.end();
    });
  } catch (error) {
    console.error("流式接口错误:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "服务器内部错误" });
    }
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// ============ AI ChatMessage Routes ============
// 非流式聊天
app.post("/chatMessage", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages))
    return res.status(400).json({ message: "messages 必须是非空数组!" });

  const result = await axios.post(AI_URL, {
    model: "qwen-plus",
    messages,
    stream: false,
  }, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_SK_KEY}`,
    },
    timeout: 30000,
  });

  res.json({ status: 200, data: result.data.choices[0].message.content });
});

// 流式
app.post("/chatMessage/stream", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages))
    return res.status(400).json({ error: "messages 必须是非空数组!" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const result = await axios({
    method: "post",
    url: AI_URL,
    data: { model: "qwen-plus", messages, stream: true },
    headers: {
      Authorization: `Bearer ${AI_SK_KEY}`,
      "Content-Type": "application/json",
    },
    responseType: "stream",
    timeout: 60000,
  });

  let buffer = "";
  result.data.on("data", (chunk) => {
    const chunkstr = chunk.toString();
    buffer += chunkstr;
    let lines = buffer.split(/\n/);
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content || "";
          if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
        } catch (e) {}
      }
    }
  });
  result.data.on("end", () => res.end());
  result.data.on("error", () => res.end());
});

// ============ RAG Routes ============
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

app.post("/rag/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "请上传PDF文件" });
    }
    // 简化版 RAG：兼容缺失的 AI 服务
    res.json({
      status: 200,
      message: `文档已接收: ${req.file.originalname}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "上传异常" });
  }
});

app.post("/rag/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "请提供问题" });
    }
    // 简化版问答
    res.json({
      status: 200,
      answer: `收到你的问题: "${question}"。当前 RAG 服务尚未配置完整，请先上传 PDF 文档。`,
      sources: [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 错误处理 ============
app.use((err, _req, res, _next) => {
  console.error("Server error:", err);
  res.status(500).json({ message: "服务器内部错误", error: err.message });
});

// 导出 Express 实例（EdgeOne Pages 要求）
export default app;
