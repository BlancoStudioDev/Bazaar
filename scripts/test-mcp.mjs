import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const servers = {
  amazon: {
    command: "/Users/blanco05/.config/opencode/mcp/.venv/bin/python",
    args: ["/Users/blanco05/.config/opencode/mcp/amazon/server.py"],
  },
  aliexpress: {
    command: "/Users/blanco05/.config/opencode/mcp/.venv/bin/python",
    args: ["/Users/blanco05/.config/opencode/mcp/aliexpress/server.py"],
  },
  vinted: {
    command: "/Users/blanco05/.config/opencode/mcp/.venv/bin/python",
    args: ["/Users/blanco05/.config/opencode/mcp/vinted/server.py"],
  },
  subito: {
    command: "/Users/blanco05/.config/opencode/mcp/subito-search/.venv/bin/python",
    args: ["/Users/blanco05/.config/opencode/mcp/subito-search/server.py"],
  },
  "facebook-marketplace": {
    command: "/Users/blanco05/.config/opencode/mcp/facebook-marketplace/.venv/bin/python",
    args: ["/Users/blanco05/.config/opencode/mcp/facebook-marketplace/server.py"],
  },
};

const name = process.argv[2] || "amazon";
const query = process.argv[3] || "borsa longchamp";
const limit = Number(process.argv[4] || 3);
const fullOutput = process.argv.includes("--full");
const config = servers[name];
const client = new Client({ name: "bazaar-test", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: config.command,
  args: config.args,
  stderr: "pipe",
});
transport.stderr?.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
await client.connect(transport);
console.log(`connected to ${name}`);
const tools = await client.listTools();
for (const tool of tools.tools) {
  console.log("-", tool.name, JSON.stringify(tool.inputSchema?.properties ?? {}));
}
const test = {
  amazon: ["search_amazon", { query: query, limit, format: "json" }],
  aliexpress: ["search_aliexpress", { query: query, limit, format: "json" }],
  vinted: ["search_vinted", { query: query, limit, format: "json" }],
  subito: ["search_subito", { query: query, limit }],
  "facebook-marketplace": ["search_marketplace", { query: query, city: "Milano", limit, format: "json" }],
}[name];
if (test) {
  const started = Date.now();
  const result = await client.callTool({ name: test[0], arguments: test[1] }, undefined, { timeout: name === "facebook-marketplace" ? 28_000 : 20_000 }).catch((error) => {
    console.log(`ERRORE dopo ${Date.now() - started}ms: ${error.message}`);
    process.exit(1);
  });
  console.log(`tool ${test[0]} took ${Date.now() - started}ms`);
  const text = result.content?.find((part) => part.type === "text")?.text;
  console.log(fullOutput ? text : text?.slice(0, 1200));
  if (name === "facebook-marketplace" && text) {
    try {
      for (const item of JSON.parse(text).annunci ?? []) {
        console.log(`FB id=${item.id} url=${item.url} diretto=${/\/marketplace\/item\/\d+/.test(item.url || "")}`);
      }
    } catch {}
  }
}
await client.close();
process.exit(0);
