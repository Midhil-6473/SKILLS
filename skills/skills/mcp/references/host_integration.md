# Connecting MCP Servers to Claude Desktop, Claude Code, and Other Hosts

## Claude Desktop — the classic local integration

1. Open Claude Desktop → your profile → **Settings → Developer → Edit Config**.
2. This opens (or creates) the config file at:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
3. Add your server under the `mcpServers` key:

```json
{
  "mcpServers": {
    "weather": {
      "command": "uv",
      "args": ["--directory", "/ABSOLUTE/PATH/TO/weather-server", "run", "weather.py"]
    }
  }
}
```

4. **Save and fully restart Claude Desktop** (not just close the window).
5. Verify: click the tools/connectors icon in the chat interface — your server
   should be listed, and Claude will ask for permission before invoking any of its
   tools the first time.

**Common gotchas:**
- Use **absolute paths** — the working directory the host launches from is not your
  project directory.
- If `uv` isn't on the system `PATH` as seen by Claude Desktop, use the full path to
  the `uv` executable (`which uv` on macOS/Linux, `where uv` on Windows).
- On Windows, use forward slashes or escaped double backslashes (`\\`) in JSON paths.
- Claude Desktop is not currently available on Linux — Linux users build/test
  against a custom client instead (see `building_clients.md`).

## Claude Code — connecting via CLI

```bash
claude mcp add <server-name>
```

Claude Code can also browse the **Anthropic Directory** of reviewed, pre-vetted
connectors and add any listed remote server directly. Directory connectors use the
same underlying MCP infrastructure as any custom server you'd configure manually.

**Security reminder specific to Claude Code:** verify you trust each server before
connecting it — servers that fetch external content (web pages, issues, emails) carry
real prompt-injection risk, as covered in `security.md`. This applies to Directory
servers too, not just hand-rolled ones.

### Resources via `@`-mention

Once connected, resources exposed by a server appear in Claude Code's `@`-mention
autocomplete, the same as local files — type `@` to see available resources from all
connected servers.

### Elicitation in Claude Code

When a server requests structured input via elicitation (see
`advanced_features.md`), Claude Code shows an interactive dialog automatically — no
configuration needed on your end. Two modes: a form dialog for structured field
input, or a browser URL for OAuth-style flows, with confirmation back in the CLI.

### Tool search — keeping context usage low with many servers

Claude Code defers full tool *definitions* until they're actually needed — only tool
*names* and server instructions load into context at session start. This means
connecting many MCP servers has minimal impact on your available context window,
compared to naively loading every tool's full schema upfront.

### Authentication and re-authentication

If a configured server requires OAuth and the stored token expires or is rejected,
Claude Code surfaces a notice pointing at the `/mcp` panel, where you can
re-authenticate. In non-interactive mode (`claude -p`, or an SDK-driven run), Claude
Code can't run an interactive OAuth flow — it instead reports the server's tools as
unavailable until you authorize it interactively first.

## Scaffolding a new server directly from Claude

Claude Code ships an official `mcp-server-dev` plugin that scaffolds a new server for
you interactively:

```bash
/plugin marketplace add anthropics/claude-plugins-official   # if not already added
# then install and run the mcp-server-dev plugin — it asks about your use case
# and scaffolds a remote HTTP or local stdio server accordingly
```

## Other hosts — the general pattern

Every MCP-compatible host follows broadly the same shape: a config file or UI
listing `mcpServers` (or equivalent), each specifying either a local launch command
(stdio) or a remote URL (Streamable HTTP). The specifics vary:

| Host | Configuration approach |
|---|---|
| **Claude Desktop** | `claude_desktop_config.json`, `mcpServers` key |
| **Claude Code** | `claude mcp add`, or the Directory browser |
| **Cursor** | Settings → MCP, similar JSON config format |
| **VS Code (Copilot)** | `settings.json` or a dedicated MCP config section |
| **ChatGPT** | Connector/plugin configuration in settings, for supported remote servers |

Because the underlying protocol is identical, **a well-built server generally works
across all of these hosts with no server-side changes** — the value proposition of
"write once, integrate everywhere" that makes MCP worth adopting in the first place.

## Testing before connecting to any host: the MCP Inspector

```bash
mcp dev server.py
```

Always test a server with the official Inspector before wiring it into a real host —
it shows raw JSON-RPC traffic, lets you manually invoke tools/resources/prompts with
a form UI, and catches most integration issues faster than debugging through a full
host application's UI.

## Practical guidance

1. **Always use absolute paths and fully restart the host** after editing a stdio
   config file — a partial reload frequently doesn't pick up new servers.
2. **Test with the MCP Inspector first**, before wiring a server into any host.
3. **Treat every server connection (including Directory-listed ones) as a trust
   decision** — verify before connecting, per `security.md`.
4. **Expect the same server to work across hosts with no changes** — if it doesn't,
   the issue is almost always transport/config, not the server's core logic.