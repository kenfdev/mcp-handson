# Step 01: stdio で最小の MCP tool を動かす

## この step の目的

MCP server をいきなり HTTP、OAuth、TLS 付きで作ると、問題の切り分けが難しくなります。

最初は `stdio` transport だけを使い、MCP の最小単位である **tool contract** が成立しているかを確認します。

この step で確認することは次です。

- MCP server が client から発見できる
- `tools/list` で tool の contract が返る
- `tools/call` で tool が実行できる
- tool の説明、input schema、metadata が client/agent に見える

## 追加したもの

### Workspace

- `package.json`
- `pnpm-workspace.yaml`
- `apps/task-notes-mcp/package.json`
- `apps/task-notes-mcp/tsconfig.json`

MCP server を単体 app として育てられるように、pnpm workspace にしました。

将来的に `apps/local-auth-server` を追加するため、最初から `apps/*` 構成にしています。

### Task Notes の最小 domain

- `apps/task-notes-mcp/src/db.ts`
- `apps/task-notes-mcp/src/repository.ts`

Task Notes は MCP の題材であり、主役ではありません。

そのため、この step では SQLite ではなく file-backed JSON store を使っています。repository 境界を置いているので、後で SQLite に戻しても MCP tool 側の contract は変わりません。

### Tool policy

- `apps/task-notes-mcp/src/tool-policy.ts`

MCP tool は単なる関数ではなく、agent-facing contract です。

`list_task_notes` には次の policy を付けています。

- `requiredScopes: ["task_notes:read"]`
- `readOnly: true`
- `destructive: false`
- `sideEffect: "none"`

今の stdio step では scope enforcement はまだ行いません。後続の HTTP/JWT step で、この policy を実際の認可判定に使います。

### MCP server

- `apps/task-notes-mcp/src/mcp-server.ts`
- `apps/task-notes-mcp/src/stdio.ts`

`mcp-server.ts` では `list_task_notes` tool を登録しています。

重要なのは実行関数よりも、その前に client/agent に公開される contract です。

- `name`: agent が呼ぶ安定識別子
- `title`: UI 表示向けの短い名前
- `description`: agent が tool 選択に使う説明
- `inputSchema`: 引数の構造と制約
- `annotations`: read-only / destructive など client 判断に使えるヒント
- `_meta.policy`: server 側 policy と監査のための machine-readable metadata

## なぜ stdio から始めるのか

stdio は local MCP server の基本 transport です。

ここで tool discovery と tool call が動けば、少なくとも次は切り分けられます。

- MCP server の tool 定義は成立している
- Zod schema は JSON Schema として client に見えている
- tool output は MCP result として返っている

逆に、ここを飛ばして HTTP/OAuth/TLS から始めると、失敗時に原因が分かりにくくなります。

## 検証コマンド

```bash
rtk pnpm build
```

stdio smoke test:

```bash
rtk pnpm --filter task-notes-mcp exec node --input-type=module -e '
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = process.cwd().replace(/\/apps\/task-notes-mcp$/, "");
const transport = new StdioClientTransport({
  command: "pnpm",
  args: ["--filter", "task-notes-mcp", "dev:stdio"],
  cwd: root,
});

const client = new Client({ name: "smoke-test", version: "0.1.0" });
await client.connect(transport);
console.log(JSON.stringify(await client.listTools(), null, 2));
console.log(JSON.stringify(await client.callTool({ name: "list_task_notes", arguments: {} }), null, 2));
await client.close();
'
```

## この step で学ぶこと

MCP の最初の山は transport ではなく tool contract です。

agent は人間向け API docs を読んでいるのではなく、tool name、description、schema、metadata を見て行動します。

したがって production-ready な MCP server では、tool の実装だけでなく、tool が agent からどう見えるかを設計対象にします。
