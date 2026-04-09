const fs = require("fs").promises;
const path = require("path");
const csvPath = path.join(__dirname, "utils", "data.csv");
const outjson = path.join(__dirname, "utils", "output.json");
async function csvToJson() {
  try {
    // 读取csv文件的内容
    const csvContent = await fs.readFile(csvPath, "utf-8");
    // 按行分割
    const lines = csvContent.split(/\r?\n/);
    if (lines.length == 0) throw new Error("CSV文件为空");
    // 第一行是表头
    const headers = lines[0].split(",");
    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim(); // 跳过空行
      if (line === "") continue;
      const values = line.split(",");
      //   如果某一行的列数不等于表头列数，可以跳过或者报错
      if (values.length !== headers.length) continue;
      const obj = {};
      for (let j = 0; j < values.length; j++) {
        obj[headers[j]] = values[j];
      }
      result.push(obj);
    }
    await fs.writeFile(outjson, JSON.stringify(result, null, 2), "utf-8");
    return result;
  } catch (error) {
    console.log(error, "报错喽");
  }
}
(async () => {
  const data = await csvToJson();
  console.log(data);
})();
