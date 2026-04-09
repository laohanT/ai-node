const axios = require("axios");

// 一次性返回
const chat = async (req, res, next) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages))
      return res.status(400).json({ message: "参数必须是非空数组!" });
    const reqBody = {
      model: "qwen-plus",
      messages,
      stream: false,
    };
    const result = await axios.post(process.env.AI_URL, reqBody, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Authorization Bearer ${process.env.AI_SK_KEY}`,
      },
      timeout: 30000,
    });
    const aiMsg = result.data.choices[0].message.content;
    res.json({
      status: 200,
      data: aiMsg,
    });
  } catch (error) {
    console.log(error, "error");

    if (error.response) {
      // 将百炼返回的错误信息传递给前端
      return res
        .status(error.response.status)
        .json({ error: error.response.data });
    }
    next(error);
  }
};

// 流式返回
const chatStream = async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages 字段必须是非空数组" });
    }
    //   设置SSE响应头
    res.setHeader("Content-type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // 立即发送响应头

    const reqBody = {
      model: "qwen-plus",
      messages,
      stream: true, // 开启流式
    };
    const result = await axios({
      method: "post",
      url: process.env.AI_URL,
      data: reqBody,
      headers: {
        Authorization: `Bearer ${process.env.AI_SK_KEY}`,
        "Content-Type": "application/json",
      },
      responseType: "stream", // 关键：以流的方式接收
      timeout: 60000,
    });
    let buffer = "";
    // result.data.是一个可读的流
    /**
     * Node.js 流的标准用法
     * 流没接收一个新的数据块，就会触发这个回调
     * */
    result.data.on("data", (chunk) => {
      // SSE 数据本质是文本 转换为String 是为了好处理
      const chunkstr = chunk.toString();
      buffer += chunkstr;
      // 按行分割，因为 SSE 数据通常以 \n\n 分隔
      //   完成的SSE消息 使用\n
      let lines = buffer.split(/\n/);
      console.log(lines, "lines");

      buffer = lines.pop(); // 保留未完成的行
      for (const line of lines) {
        // 判断是否为SSE的数据行，每个事件以data: 开头（注意空格）
        if (line.startsWith("data: ")) {
          // 提取JSON数据串
          const data = line.slice(6);
          //   结束标记
          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
          try {
            // 解析JSON 提取内容
            const parsed = JSON.parse(data);
            // 标准的openAI响应结构
            const content = parsed.choices[0]?.delta?.content || "";
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (error) {
            console.log(error, "解析错误");
          }
        }
      }
    });
    // AI服务数据流正常结束时会触发
    result.data.on("end", () => {
      res.end();
    });
    // 底层流发生错误（服务端会主动断开），触发error
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
};

module.exports = { chat, chatStream };
