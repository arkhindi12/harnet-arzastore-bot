const http = require("http");
const https = require("https");
const { URL } = require("url");

function testProxy(proxyUrl, targetUrl = "http://api.ipify.org/?format=json", timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const proxy = new URL(proxyUrl);
      const target = new URL(targetUrl);
      const isHttps = target.protocol === "https:";
      const options = {
        host: proxy.hostname,
        port: parseInt(proxy.port) || (proxy.protocol === "https:" ? 443 : 1080),
        method: "CONNECT",
        path: target.hostname + ":" + (target.port || (isHttps ? 443 : 80)),
        timeout: timeoutMs,
      };
      if (proxy.username) {
        const auth = Buffer.from(decodeURIComponent(proxy.username) + ":" + decodeURIComponent(proxy.password)).toString("base64");
        options.headers = { "Proxy-Authorization": "Basic " + auth };
      }
      const req = http.request(options);
      req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ status: "dead", error: "timeout", latency_ms: null }); });
      req.on("connect", (res, socket) => {
        const latency_ms = Date.now() - start;
        socket.destroy();
        if (res.statusCode === 200) resolve({ status: "alive", latency_ms, ip: null });
        else resolve({ status: "dead", error: "connect status " + res.statusCode, latency_ms });
      });
      req.on("error", (e) => resolve({ status: "dead", error: e.message, latency_ms: null }));
      req.end();
    } catch(e) {
      resolve({ status: "dead", error: e.message, latency_ms: null });
    }
  });
}

module.exports = { testProxy };
