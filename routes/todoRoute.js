/**
 * TODO 代办事项 监听3000
 * 提供get todos
 * post todos
 * put todos/:id
 * delete todos/:id
 * */
const express = require("express");
const router = express.Router();
const {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
} = require("../controllers/todoController");
router.get("/", getTodos);
router.post("/", createTodo);
router.put("/:id", updateTodo);
router.delete("/:id", deleteTodo);

module.exports = router;
