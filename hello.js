console.log("你好");
const fs = require("fs").promises;
const path = require("path");

// fs.readFile("./data.txt", "utf-8")
//   .then((res) => {
//     console.log(res);
//   })
//   .catch((err) => {
//     console.log(err);
//   });

const filePath = path.join(__dirname, "data.txt");

async function readFile() {
  try {
    let res = await fs.readFile(filePath, "utf-8");
    console.log(res, "res");
  } catch (error) {
    console.log(error, "error");
  }
}
// readFile();

// console.log(path.join(__dirname, "utils", "data.csv"));

function getDataPath(relativePath) {
  console.log(path.join(__dirname, relativePath));
}
console.log(process.cwd(), "cwd");

getDataPath("data.txt");
getDataPath("utils/data.csv");
