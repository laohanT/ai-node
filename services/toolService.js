// 工具服务
const axios = require("axios");
const areas = require("../constant/area.json");
// 获取城市的天气
const getWeather = async (city) => {
  try {
    const adCode = areas.find((area) => area.cityName.includes(city))?.adcode;
    const res = await axios({
      method: "get",
      url: process.env.WEATHER_URL,
      params: {
        key: process.env.GD_KEY,
        city: adCode,
        extensions: "base", // base 插叙实况天气  all 查询预告天气
      },
    });
    // 实况天气只返回一条
    const weather = res.data.lives ? res.data.lives[0] : [];
    return `${weather.province}省${weather.city}，当前天气：${weather.weather}，温度：${weather.temperature}℃；风向：${weather.winddirection}，风速：${weather.windpower}级，空气湿度：${weather.humidity}。
    发布时间：${weather.reporttime}
    `;
  } catch (error) {
    console.log("天气API调用失败！", error);
    return "天气服务暂不可用，请稍后重试！";
  }
};

// 2. 计算器（安全地计算数学表达式）
function getCurrentTime() {
  const date = new Date();
  let y, m, d, hh, mm, ss;
  y = date.getFullYear();
  m = date.getMonth() + 1;
  d = date.getDate();
  hh = date.getHours();
  mm = date.getMinutes();
  ss = date.getSeconds();
  return `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")} ${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

module.exports = { getWeather, getCurrentTime };
