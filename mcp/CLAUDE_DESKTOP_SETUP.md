# Claude Desktop MCP Setup

## What this does

This MCP server lets Claude Desktop query and update your Personal CRM. Once configured, you can ask Claude things like:

- "Who haven't I talked to in 30 days?"
- "Show me my recent interactions"
- "Log a 15-minute call with Sarah"
- "How often do I talk to Bob?"

---

## Prerequisites

- CRM API must be running: `cd api && npm run dev` (runs on port 3001)
- MCP server dependencies installed: `cd mcp && npm install`

---

## Config File Location (macOS)

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

---

## Setup Steps

### 1. Add the MCP server to your Claude Desktop config

Open the config file and add the `personalcrm` entry inside `mcpServers`:

```json
{
  "mcpServers": {
    "personalcrm": {
      "command": "node",
      "args": ["/Users/michaelobrien/ClaudeCode/personal-crm/mcp/src/index.js"],
      "env": {
        "API_URL": "http://localhost:3001"
      }
    }
  }
}
```

If you already have other MCP servers configured, add `personalcrm` alongside them — do not replace the existing entries.

### 2. Restart Claude Desktop

Completely quit Claude Desktop (Cmd+Q) and reopen it.

### 3. Verify tools are available

In a new Claude conversation, you should see a tools icon. Ask Claude:

```
Who are my contacts?
```

Claude should call the `get_contacts` tool and return data from your database.

---

## Troubleshooting

**Claude doesn't see CRM tools:**
- Make sure Claude Desktop was fully restarted (not just the window)
- Check the path in `args` is exactly correct
- Run `node /Users/michaelobrien/ClaudeCode/personal-crm/mcp/src/index.js` in a terminal — if it hangs silently, that's correct (it's waiting for stdin from Claude)

**Tool calls fail with "connection refused":**
- The CRM API is not running — start it with `cd api && npm run dev`
- Verify port 3001 is free: `lsof -i:3001`

**"Unknown tool" errors:**
- Restart the MCP server by restarting Claude Desktop

---

## When deploying to Vercel (Phase 6)

Update the `env` in the config to point to your cloud API URL:

```json
"env": {
  "API_URL": "https://your-crm-api.vercel.app"
}
```

Then restart Claude Desktop.
