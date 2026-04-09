require("dotenv").config();
const axios = require("axios");

const callDeepseek = async (prompt) => {
  console.log(process.env.AI_URL, "lll", prompt);
  try {
    const res = await axios.post(
      process.env.AI_URL,
      {
        model: "qwen-plus",
        messages: [{ role: "user", content: prompt }],
        stream: false,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.AI_SK_KEY}`,
        },
        timeout: 30000,
      },
    );
    const aiMessage = res.data.choices[0].message.content;
    console.log(`🤖 AI回答: ${aiMessage}`);
    return aiMessage;
  } catch (error) {
    // 错误处理
    console.error("❌ 调用DeepSeek API时出错:");
    if (error.response) {
      // 请求已发送，但服务器响应了状态码（如4xx, 5xx）
      console.error(`状态码: ${error.response.status}`);
      console.error(`错误详情: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // 请求已发送，但没有收到响应
      console.error("未收到API响应，请检查网络连接");
    } else {
      console.error(error.message);
    }
  }
};

async function main() {
  if (!process.env.AI_SK_KEY) {
    console.error("❌ 错误：未找到DASHSCOPE_API_KEY，请在.env文件中配置。");
    return;
  }
  await callDeepseek("请用中文介绍一下什么是Node.js？");
}
main();
