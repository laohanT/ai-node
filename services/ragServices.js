/**
 * 1、从PDF提取文本
 * 2、将长文本切分成小块（chunk）
 * 3、为每个小块生成向量（embedding）并存储
 * 4、对用户问题生成向量，计算与存储块的相似度，检索最相关的块
 * 5、将检索到的块作为上下文，调用大模型生成回答
 * */
const axios = require("axios");
// 导入pdf-parse库 提取pdf文件内容
const pdf = require("pdf-parse");

// 导入langchain/textsplitters库 分割文本
// 从 LangChain 导入智能文本分割器。它会递归地尝试按分隔符（段落、句子、标点等）切分文本，尽量保持语义完整。
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
// 导入阿里云的embedding服务
const EMBEDDING_URL = process.env.EMBEDDING_URL;
// 存储分割后的文本，全局向量存储，作为向量数据库
let chunksStore = [];
// ----------------向量生成----------------
async function getEmbedding(text) {
  const response = await axios.post(
    EMBEDDING_URL,
    {
      model: "text-embedding-v2",
      //   字符串数组，目前只传了一个
      input: { texts: [text] },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.AI_SK_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    },
  );
  // 返回的是一个浮点数数组，因为只传了一个 所以取第一个
  return response.data.output.embeddings[0];
}

// ----余弦相似度计算----
function cosineSimilarity(vecA, vecB) {
  // [-1,1]越接近1 越相似
  //   0 标识不相似
  if (vecA.length !== vecB.length) return 0;
  let dot = 0, // 点积（对应元素相乘后求和）
    magA = 0, // 向量A的模的平方（各元素平方和）
    magB = 0; // 向量B的模的平方
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  //   余弦相似度=点积 / (A模 * B模)
  //   Math.sqrt(magA) 计算向量 A 的模（长度）
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ----------------pdf文本提取----------------
async function extractTextFromPdf(buffer) {
  const data = await pdf(buffer);
  return data.text;
}
//  --------文本切块-----------------
async function splitText(text) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500, // 每块最大字符
    chunkOverlap: 50, // 相邻块重叠50字符，避免上下文断裂
    separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""], // 优先按照句子切分
  });
  const docs = await splitter.createDocuments([text]);
  return docs.map((doc) => doc.pageContent);
}

// ----添加文档（对外接口） -----
// 参数可以是pdf文件的buffer，或者直接传入文本字符串
async function addDocument(source, isPdfBuffer = true) {
  // 初始化
  chunksStore = [];
  let fullText = "";
  if (isPdfBuffer) {
    // PDF文本提取
    fullText = await extractTextFromPdf(source);
  } else {
    fullText = source;
  }
  //   文本切块，返回的是一个数组
  const chunks = await splitText(fullText);
  for (let i = 0; i < chunks.length; i++) {
    // 获取每一个切块的向量值
    const embedding = await getEmbedding(chunks[i]);
    // 存入假库中
    chunksStore.push({
      id: `${Date.now()}_${i}`,
      text: chunks[i],
      embedding,
    });
  }

  //   返回切块数量
  return {
    length: chunks.length,
    chunksStore: chunksStore.map((item) => ({ id: item.id, text: item.text })),
  };
}

// ------------检索相似块------------
async function retrieve(query, topK = 5) {
  // 将用户问题生成向量快
  const queryEmbedding = await getEmbedding(query);
  //   计算每个存储块与查询的相似度，检索最相关的块

  const scored = chunksStore.map((chunk) => ({
    text: chunk.text,
    // 对比值
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  //  对比值的score 从大到小排序
  scored.sort((a, b) => b.score - a.score);
  //   最终返回的是 切块后的文本
  return scored.slice(0, topK).map((item) => item.text);
}

// ---------生成回答（基于检索到的上下文）-----------
async function generateAnswer(query, contextTexts) {
  // 用分隔符隔开不同来源
  const context = contextTexts.join("\n\n---\n\n");
  const prompt = `你是一个专业的文档问答助手。请根据下面提供的文档内容，回答用户的问题。如果文档内容中没有相关信息，请明确“回答文档中没有提及该内容”。不要编造信息
  【文档内容】
  ${context}
  【用户问题】
  ${query}
  【回答】
  `;
  const response = await axios.post(
    process.env.AI_URL,
    {
      model: "qwen-plus",
      messages: [{ role: "user", content: prompt }],
      stream: false, //非流式
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.AI_SK_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    },
  );
  return response.data.choices[0].message.content;
}

module.exports = {
  addDocument, // 添加文档
  retrieve, // 检索相似块
  generateAnswer, // 生成回答
};
// 为什么需要文本切块：大模型上下文长度有限（比如 8k token），且向量检索时整篇文章太长会导致检索不精确。切块后可以只取最相关的片段。

// 为什么需要重叠：避免关键信息恰好被切在边界上而丢失。

// 余弦相似度：衡量两个向量方向的相似程度，值越接近 1 表示越相关。这是向量检索中最常用的距离度量。
