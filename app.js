require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const PORT = process.env.ENV_PORT || 3000;
app.use(cors());
app.use(express.json());
// TODO API
app.use("/todos", require("./routes/todoRoute"));
app.use("/chat", require("./routes/aiRoute"));
app.use("/chatMessage", require("./routes/aiChatRoute"));

app.use((err, request, response, next) => {
  response.status(500).json({
    message: "服务器内部错误",
    error: err,
  });
});
app.listen(PORT, () => {
  console.log("服务已启动，监听http://localhost:" + PORT);
});
