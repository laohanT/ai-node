// 创建会话历史

const { default: axios } = require("axios");

// 会话存储：{sessionId: [{role,content}]}
const sessions = new Map();

// 获取或者创建会话历史
function getOrCreateSession(sessionId) {
  // 如果没有找到
  if (!sessions.has(sessionId)) {
    // 设置AI助手的角色
    sessions.set(sessionId, [
      { role: "system", content: "你是一个乐于助人的助手" },
    ]);
  }
  return sessions.get(sessionId);
}

// 保存消息到会话
function saveChat(sessionId, role, content) {
  const history = getOrCreateSession(sessionId);
  history.push({ role, content });
  if (history.length > 20) history.splice(1, 1); //保留system
}

// 获取会话消息
function getHistory(req, res) {
  const { sessionId } = req.query;
  if (!sessions.has(sessionId))
    return res.status(404).json({ message: "会话历史不存在" });
  res.json({
    status: 200,
    sessionId,
    data: sessions.get(sessionId),
  });
}
// 删除会话消息
function delHistory(req, res) {
  const { sessionId } = req.params;
  if (!sessions.has(sessionId))
    return res.status(404).json({ message: "会话历史不存在" });
  res.status(204).send();
  sessions.delete(sessionId);
}
// 获取所有的会话记录
function getAllChat(req, res) {
  try {
    // const entries = [...sessions.entries()];
    // console.log(entries, "总体的");
    const entries = [];
    for (const [key, value] of sessions) {
      entries.push({ sessionId: key, data: value.filter(item => item.role === 'user' || item.role === 'assistant') });
    }
    res.json({
      status: 200,
      data: entries,
    });
  } catch (error) {
    res.status(500).json({ message: "Map解析失败" });
  }
}

// 非流式AI返回，会话管理
async function chat(req, res, next) {
  try {
    const { sessionId, messages } = req.body;
    if (!sessionId)
      return res.status(400).json({ message: "缺少参数sessionId" });
    if (!messages) return res.status(400).json({ message: "参数不能为空！" });

    // 获取历史消息
    const history = getOrCreateSession(sessionId);
    console.log(history, "history");

    saveChat(sessionId, "user", messages);
    const reqBody = {
      model: "qwen-plus",
      messages: history,
      stream: false,
    };
    const result = await axios({
      url: process.env.AI_URL,
      method: "post",
      data: reqBody,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_SK_KEY}`,
      },
      timeout: 30000,
    });
    console.log(result, "res");

    const aiMsg = result.data.choices[0].message.content;
    // 保存AI回复到历史
    saveChat(sessionId, "assistant", aiMsg);
    console.log(sessions, "总的会话历史");

    res.json({
      status: 200,
      data: { aiMsg, sessionId },
      sessions,
    });
  } catch (error) {
    console.log(error, "error");

    next(error);
  }
}

// 流式返回，会话管理
async function chatStream(req, res, next) {
  try {
    const { sessionId, messages } = req.body;
    if (!sessionId || !messages)
      return res.status(400).json({ message: "参数异常" });
    // 历史数据
    const history = getOrCreateSession(sessionId);
    // 存入用户输入的数据
    saveChat(sessionId, "user", messages);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // 立即发送响应头

    const reqBody = {
      model: "qwen-plus",
      messages: history,
      stream: true, // 开启流式
    };
    const result = await axios({
      url: process.env.AI_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_SK_KEY}`,
      },
      data: reqBody,
      responseType: "stream", //流式
      timeout: 60000,
    });
    let buffer = "";
    let fullAnswer = "";
    // 处理流式返回
    result.data.on("data", (chunk) => {
      const chunkStr = chunk.toString();
      buffer += chunkStr;
      //   SSE数据通常用\n\n分隔
      const lines = buffer.split("\n");
      buffer = lines.pop(); // 保存最后一行
      for (const line of lines) {
        // 处理SSE返回的数据行
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          //   结束
          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || "";
            // 抛除 ''
            if (content) {
              /**
               * 为了适配SSE数据格式
               * 包裹成对象为了后续更好的扩展性
               * */
              fullAnswer += content;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (error) {
            console.log(error, "解析错误");
          }
        }
      }
    });

    result.data.on("end", () => {
      res.end();
      saveChat(sessionId, "assistant", fullAnswer);
    });

    result.data.on("error", (err) => {
      console.warn("流式接收错误", err);
      res.write(`data: ${JSON.stringify({ error: "AI服务终端" })}\n\n`);
      res.end();
    });
  } catch (error) {
    console.log(error, "流式错误");
    next(error);
  }
}

module.exports = { chat, chatStream, getHistory, delHistory, getAllChat };
