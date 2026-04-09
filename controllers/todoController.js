// 假装是数据库
let todoList = [
  {
    id: 1,
    todoName: "吃饭",
  },
  {
    id: 2,
    todoName: "铲猫砂",
  },
  {
    id: 3,
    todoName: "遛狗",
  },
  {
    id: 4,
    todoName: "买菜",
  },
  {
    id: 5,
    todoName: "做饭",
  },
];

// get
const getTodos = (req, res) => {
  res.json({
    status: 200,
    data: todoList,
  });
};
// post
const createTodo = (req, res) => {
  const { todoName = "" } = req.body;
  const id = todoList.length + 1;
  todoList.push({
    todoName,
    id,
  });
  res.json({
    status: 201,
    data: {
      todoName,
      id,
    },
  });
};
// put
const updateTodo = (req, res) => {
  const { id } = req.params;
  todoList.forEach((item) => {
    if (item.id == id) {
      item.complete = true;
    }
  });
  res.status(200).json({
    data: todoList.find((item) => item.id == id),
  });
};
// delete
const deleteTodo = (req, res) => {
  const { id } = req.params;
  const index = todoList.findIndex((item) => item.id == id);
  if (index == -1) return res.status(404).json({ message: "资源未找到" });
  todoList.splice(index, 1);
  res.status(204).send();
};

module.exports = {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
};
