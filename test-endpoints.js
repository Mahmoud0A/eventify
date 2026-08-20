const http = require("http");

function test(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 3000,
      path: path,
      method: method,
      headers: { "Content-Type": "application/json" }
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log("Testing /health...");
  const h = await test("/health");
  console.log(h.status, h.body);

  console.log("\nTesting /v1/events...");
  const e = await test("/v1/events");
  console.log(e.status, e.body);

  console.log("\nTesting /v1/events?page=1&limit=2...");
  const ep = await test("/v1/events?page=1&limit=2");
  console.log(ep.status, ep.body);
}

run().catch(console.error);
