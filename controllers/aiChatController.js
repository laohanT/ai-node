// 创建会话历史

const { default: axios } = require("axios");
const crypto = require("crypto");
// 外部工具 function calling
const toolService = require("../services/toolService");

// 会话存储：{sessionId: [{role,content}]}
const sessions = new Map();

// 获取或者创建会话历史
function getOrCreateSession(sessionId) {
  // 如果没有找到
  if (!sessions.has(sessionId)) {
    // 设置AI助手的角色
    sessions.set(sessionId, [
      { role: "system", content: "你是一个乐于助人的全能助手" },
    ]);
  }
  return sessions.get(sessionId);
}

// 保存消息到会话
function saveChat(sessionId, role, content, id) {
  const history = getOrCreateSession(sessionId);
  if (id) {
    history.push({ id, role, content });
  } else {
    history.push({ role, content });
  }
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
      entries.push({
        sessionId: key,
        data: value.filter(
          (item) => item.role === "user" || item.role === "assistant",
        ),
      });
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

    saveChat(sessionId, "user", messages, crypto.randomUUID());
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

    const aiMsg = result.data.choices[0].message.content;
    // 保存AI回复到历史
    saveChat(sessionId, "assistant", aiMsg, crypto.randomUUID());

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
    saveChat(sessionId, "user", messages, crypto.randomUUID());

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
      saveChat(sessionId, "assistant", fullAnswer, crypto.randomUUID());
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

// 支持function calling的非流式聊天接口
async function chatWithTools(req, res, next) {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: "sessionId 和 message 必填" });
    }
    // 获取或者创建会话历史
    const history = getOrCreateSession(sessionId);
    // 保存用户消息
    saveChat(sessionId, "user", message, crypto.randomUUID());
    // 创建工具
    const tools = [
      {
        type: "function",
        function: {
          name: "getWeather",
          description: "当你想知道某个城市的天气时非常有用",
          parameters: {
            type: "object",
            properties: {
              city: {
                type: "string",
                description: "城市或者区县，比如北京市、杭州市、余杭区",
              },
            },
            required: ["city"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "getCurrentTime",
          description: "当你想要知道当前时间时非常有用",
          parameters: {},
        },
      },
    ];

    // 第一次请求大模型
    let reqBody = {
      model: "qwen-plus",
      messages: history,
      tools,
      tool_choice: "auto",
      stream: false,
    };

    let response = await axios({
      method: "post",
      url: process.env.AI_URL,
      headers: {
        Authorization: `Bearer ${process.env.AI_SK_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
      data: reqBody,
    });

    let assistantMessage = response.data.choices[0].message;
    // 将 assistant 的原始消息存入历史（包括 tool_calls 字段）
    history.push(assistantMessage);
    // 循环处理 tool_calls（可能一次返回多个）
    while (
      assistantMessage.tool_calls &&
      assistantMessage.tool_calls.length > 0
    ) {
      const toolResult = [];
      for (const toolCall of assistantMessage.tool_calls) {
        // tools工具函数名称
        const funcName = toolCall.function.name;
        // 处理function call 需要的参数
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          args = {};
        }
        let result;
        if (funcName === "getWeather") {
          result = await toolService.getWeather(args.city);
        } else if (funcName === "getCurrentTime") {
          result = toolService.getCurrentTime();
          console.log(result, "result");
        } else {
          result = `未知工具${funcName}`;
        }
        toolResult.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      toolResult.forEach((tool) => history.push(tool));
      // 第二次请求：将 tool 结果发给模型，已经包含了工具返回的了
      // 不需要再传tool，模型会根据tool结果生成最终答案
      let secondReqBody = {
        model: "qwen-plus",
        messages: history,
        stream: false,
      };
      const secRes = await axios({
        url: process.env.AI_URL,
        method: "post",
        headers: {
          Authorization: `Bearer ${process.env.AI_SK_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
        data: secondReqBody,
      });
      assistantMessage = secRes.data.choices[0].message;
      // 存入会话中
      history.push(assistantMessage);
    }
    // 将最终返回的保存在Map中
    saveChat(
      sessionId,
      "assistant",
      assistantMessage.content,
      crypto.randomUUID(),
    );
    res.json({
      sessionId,
      message: "调用成功",
      data: assistantMessage.content,
    });
  } catch (error) {
    console.log("俺报错咧", error.message ? error.message : "");
    if (error.response) {
      return res
        .status(error.response.status)
        .json({ error: error.response.data });
    }
    next(error);
  }
}

// Function Calling 流式回复
// 简化流式
async function chatWithToolsStream(req, res, next) {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId && !message) {
      return res.status(400).json({ message: "参数异常！" });
    }
    // 先获取历史/ 新增历史
    const history = getOrCreateSession(sessionId);
    // 保存用户询问的历史
    saveChat(sessionId, "user", message, crypto.randomUUID());
    // 定义工具
    const tool = [
      {
        type: "function",
        function: {
          name: "getWeather",
          description: "当你想知道某个城市的天气时非常有用",
          parameters: {
            type: "object",
            properties: {
              city: {
                type: "string",
                description: "城市名称",
              },
            },
            required: ["city"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "getCurrentTime",
          description:
            "当你想知道今天是哪年、哪月、哪日，几时、几分、几秒、星期几时非常有用",
          parameters: {},
        },
      },
    ];
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    // 第一次请求
    const reqBody = {
      model: "qwen-plus",
      messages: history,
      stream: true,
      tools: tool,
      tool_choice: "auto",
    };

    const response = await axios({
      method: "post",
      url: process.env.AI_URL,
      headers: {
        Authorization: `Bearer ${process.env.AI_SK_KEY}`,
        "Content-Type": "application/json",
      },
      responseType: "stream",
      timeout: 60000,
      data: reqBody,
    });
    // 用于拼接tool_calls
    let toolCallsMap = new Map();
    // 告知客户端，模型本次响应的意图是调用工具，且所有 tool_calls 信息已经传输完毕
    let finishReason = null;
    // 接收流式数据
    let buffer = "";
    // 是否有function calling
    let normalContent = "";
    response.data.on("data", (chunk) => {
      // string 好处理
      const chunkStr = chunk.toString();
      buffer += chunkStr;
      const lines = buffer.split("\n");
      // 取出数组的最后一个元素（不完整的行），并重新赋值给 buffer，留到下一个 chunk 到来时继续拼接
      buffer = lines.pop();
      for (const line of lines) {
        // 标准的流式数据
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data == "[DONE]") {
            // 流结束检查是否需要处理tool_calls
            // if (finishReason === "tool_calls") {
            // 解析完整的 tool_calls
            // 注意：需要异步执行工具并再次请求，但这里不能直接 await（因为是在 data 事件中）
            // 解决方案：将后续逻辑封装成函数，在流结束后调用
            // 我们将在 'end' 事件中处理
            // } else {
            //   res.write("data: [DONE]\n\n");
            //   res.end();
            // }
            // 统一在end中处理
            return;
          }
          try {
            // 切割后的数据
            const paresed = JSON.parse(data);
            const delta = paresed.choices[0]?.delta;
            // 一般出现在最后，表示调用工具（function calling 整个流程）结束
            finishReason = paresed.choices[0]?.finish_reason; //值为 tool_calls
            if (delta?.content) {
              normalContent += delta.content;
              // 普通文本直接转发给前端
              res.write(
                `data: ${JSON.stringify({ content: delta.content })}\n\n`,
              );
            }
            //累计toolCalls
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                const index = toolCall.index;
                // 如果不存在
                if (!toolCallsMap.has(index)) {
                  toolCallsMap.set(index, {
                    id: toolCall.id || "",
                    type: toolCall.type || "",
                    function: { name: "", arguments: "" },
                  });
                }
                // 为了修改Map对象中的值
                const existing = toolCallsMap.get(index);
                existing.id = toolCall.id ? toolCall.id : "";
                if (toolCall.function?.name)
                  existing.function.name += toolCall.function.name;
                if (toolCall.function?.arguments)
                  existing.function.arguments += toolCall.function?.arguments;
              }
            }
          } catch (error) {
            console.log("解析SSE失败", error);
          }
        }
      }
    });

    response.data.on("end", async () => {
      // TODO 测试是否进入工具函数
      console.log(finishReason, "toolCalls");

      // 流结束后，判断是否有tool_calls
      if (finishReason === "tool_calls" && toolCallsMap.size > 0) {
        const toolCalls = Array.from(toolCallsMap.values());
        // 将assistant的tool_calls 消息加入历史
        const assistantToolMessage = {
          role: "assistant",
          content: null,
          tool_calls: toolCalls,
        };
        history.push(assistantToolMessage);
        // 执行工具调用，用来存历史
        const toolResults = [];
        for (const toolCall of toolCalls) {
          const funcName = toolCall.function.name;
          // 工具调用的参数
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            args = {};
          }
          // Tool调用结果
          let result;
          if (funcName === "getWeather") {
            result = await toolService.getWeather(args.city);
            console.log(result, "调用天气function calling");
          } else if (funcName === "getCurrentTime") {
            result = toolService.getCurrentTime();
          } else {
            result = `未知工具: ${funcName}`;
          }
          toolResults.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        history.push(...toolResults);

        // 第二次请求，不带tool流式
        const secondReqBody = {
          model: "qwen-plus",
          messages: history,
          stream: true,
        };

        const secResponse = await axios({
          url: process.env.AI_URL,
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.AI_SK_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
          responseType: "stream",
          data: secondReqBody,
        });
        // 第二次流式返回的数据
        let secBuffer = "";
        // AI的全部回答
        let fullAnswer = "";
        secResponse.data.on("data", (chunk) => {
          const chunkStr = chunk.toString();
          secBuffer += chunkStr;
          const lines = secBuffer.split("\n");
          secBuffer = lines.pop();
          for (const line of lines) {
            // 标准流式数据
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                // 表明流式结束
                res.write(`data: [DONE]\n\n`);
                return;
              }
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta.content || "";
                if (content) {
                  fullAnswer += content;
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              } catch (error) {
                console.log("数据解析失败", error?.message);
              }
            }
          }
        });
        secResponse.data.on("end", () => {
          saveChat(sessionId, "assistant", fullAnswer, crypto.randomUUID());
          if (!res.writableEnded) {
            // res.write("data: [DONE]\n\n");
            res.end();
          }
        });
        secResponse.data.on("error", (err) => {
          console.log("二次流式错误", err?.message);
          res.write("data: AI响应异常！");
          res.end();
        });
      } else {
        // 布尔值，标识响应已结束（res.end()是否已被调用）
        // 防止重复调用 res.end() 或在响应结束后继续写入数据。
        // 在流式场景中，判断响应是否已完成，避免内存泄漏或异常
        saveChat(sessionId, "assistant", normalContent, crypto.randomUUID());
        if (!res.writableEnded) {
          res.write("data: [DONE]\n\n");
          res.end();
        }
      }
    });
    response.data.on("error", (err) => {
      console.error("第一次流式错误:", err);
      // 标识响应头已经发送给客户端
      // 一旦调用 res.writeHead()、res.write() 或 res.end() 等会隐式发送头的方法后，res.headersSent 就会变为 true
      // 用于判断是否可以安全地设置新的响应头（例如在中间件或错误处理中）。
      // 如果 headersSent 为 true，再尝试设置状态码或响应头会抛出错误（或不起作用）。
      if (!res.headersSent) {
        res.status(500).json({ error: "AI 服务中断" });
      } else {
        res.write(`data: ${JSON.stringify({ error: "AI 服务中断" })}\n\n`);
        res.end();
      }
    });
  } catch (error) {
    console.error("chatWithToolsStream 错误:", error);
    next(error);
  }
}

// Agent 编排 （支持多轮）
async function chatAgentStream(req, res, next) {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message)
      return res.status(400).json({ message: "参数异常！" });
    // 初始化历史消息
    const history = getOrCreateSession(sessionId);
    // 保存用户消息到会话历史中
    saveChat(sessionId, "user", message, crypto.randomUUID());
    // 初始化工具
    const tools = [
      {
        type: "function",
        function: {
          name: "getWeather",
          description: "当想知道某个城市的天气时非常有用",
          parameters: {
            type: "object",
            properties: {
              city: {
                type: "string",
                description: "城市名称，北京市、杭州市、余杭区",
              },
            },
            required: ["city"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "getCurrentTime",
          description:
            "当想知道今天是哪年、哪月、哪日 几时几分几秒、星期几时非常有用",
          parameters: {},
        },
      },
    ];
    // 设置SSE响应头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    // 当前消息历史
    let currentMessage = [...history];
    // 循环次数
    let loopCount = 0;
    // 循环次数
    const MAX_LOOPS = 5;
    while (loopCount < MAX_LOOPS) {
      loopCount++;
      // 构建请求体
      const reqBody = {
        model: "qwen-plus",
        messages: currentMessage,
        stream: true,
        tools,
        tool_choice: "auto",
      };
      const response = await axios({
        url: process.env.AI_URL,
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AI_SK_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "stream",
        timeout: 60000,
        data: reqBody,
      });
      // 解析流式数据
      let buffer = "";
      // function calling 是否完成
      let finishReason = null;
      // assistant回复的文字
      let streamContent = "";
      // toolCall Map,存工具函数返回的结果
      let toolCallsMap = new Map();
      // Promise 的作用：将“事件流”转为“可等待的异步操作”
      await new Promise((reslove, reject) => {
        response.data.on("data", (chunk) => {
          const chunkStr = chunk.toString();
          buffer += chunkStr;
          // 分割数据
          const lines = buffer.split("\n");
          // 重置为最后一个，避免上下文切断
          buffer = lines.pop();
          for (const line of lines) {
            // 处理流式格式数据
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                // 表示promise结束，
                // 此处不end，等待.on("end")，自然结束
                reslove();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices[0]?.delta;
                finishReason = parsed.choices[0]?.finish_reason;
                if (delta?.content) {
                  streamContent += delta.content;
                  // 普通文本直接转发给前端
                  res.write(
                    `data: ${JSON.stringify({ content: delta.content })}\n\n`,
                  );
                }
                // 证明调用了工具函数
                if (delta?.tool_calls) {
                  for (const toolCall of delta.tool_calls) {
                    const index = toolCall.index;
                    if (!toolCallsMap.has(index)) {
                      toolCallsMap.set(index, {
                        id: toolCall.id,
                        type: toolCall.type || "function",
                        function: { name: "", arguments: "" },
                      });
                    }
                    const existing = toolCallsMap.get(index);
                    if (toolCall.id) existing.id = toolCall.id;
                    if (toolCall.function.name)
                      existing.function.name = toolCall.function.name;
                    if (toolCall.function.arguments)
                      existing.function.arguments +=
                        toolCall.function.arguments;
                  }
                }
              } catch (error) {
                console.error("SSE解析错误", error?.message);
              }
            }
          }
        });
        response.data.on("end", () => reslove());
        response.data.on("error", (error) => reject(error));
      });
      // 调用function call
      if (finishReason == "tool_calls" && toolCallsMap.size > 0) {
        const tollCalls = Array.from(toolCallsMap.values());
        // 将assistant的tool_calls消息加入历史
        currentMessage.push({
          role: "assistant",
          content: null,
          tool_calls: tollCalls,
        });
        // 并行执行所有工具
        const toolResult = await Promise.all(
          tollCalls.map(async (toolCall) => {
            const funcName = toolCall.function.name;
            // 获取参数
            let args = {};
            try {
              args = JSON.parse(toolCall.function.arguments);
            } catch (error) {
              args = {};
            }
            let result;
            if (funcName === "getWeather") {
              result = await toolService.getWeather(args.city);
            } else if (funcName === "getCurrentTime") {
              result = toolService.getCurrentTime();
            } else {
              result = `未知工具：${funcName}`;
            }
            return {
              role: "tool",
              tool_call_id: toolCall.id,
              content: result,
            };
          }),
        );
        currentMessage.push(...toolResult);
        continue;
      } else {
        // 没有工具调用
        saveChat(sessionId, "assistant", streamContent, crypto.randomUUID());
        // 发送结束标记，并关闭连接
        if (!res.writableEnded) {
          res.write("data: [DONE]\n\n");
          res.end();
        }
        // 正常结束
        return;
      }
    }
    // 超过最大循环次数，强制结束
    if (!res.writableEnded) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (error) {
    console.error("Agent 流式错误", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Agent 执行失败" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Agent 执行失败" })}\n\n`);
      res.end();
    }
    next(error);
  }
}

module.exports = {
  chat,
  chatStream,
  getHistory,
  delHistory,
  getAllChat,
  chatWithTools,
  chatWithToolsStream,
  chatAgentStream,
};
