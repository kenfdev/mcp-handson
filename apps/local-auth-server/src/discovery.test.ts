import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

const childProcesses: ChildProcess[] = [];

async function getAvailablePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  if (!address || typeof address === "string") throw new Error("Could not allocate a test port.");
  return address.port;
}

async function waitForHttpOk(url: string) {
  const deadline = Date.now() + 3000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

async function withAuthServer<T>(
  fn: (issuer: string) => Promise<T>,
): Promise<T> {
  const port = await getAvailablePort();
  const issuer = `http://127.0.0.1:${port}`;
  const child = spawn("pnpm", ["--filter", "local-auth-server", "dev"], {
    cwd: new URL("../../..", import.meta.url),
    env: {
      ...process.env,
      ISSUER: issuer,
      PORT: String(port),
    },
    stdio: "pipe",
  });
  childProcesses.push(child);

  const stderrChunks: Buffer[] = [];
  child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

  try {
    await waitForHttpOk(`${issuer}/.well-known/openid-configuration`);
    return await fn(issuer);
  } catch (error) {
    const stderr = Buffer.concat(stderrChunks).toString("utf8");
    throw new Error(`${String(error)}\nserver stderr:\n${stderr}`);
  } finally {
    child.kill();
  }
}

afterEach(() => {
  for (const child of childProcesses.splice(0)) {
    if (!child.killed) child.kill();
  }
});

describe("local-auth-server discovery", () => {
  it("serves OpenID configuration and JWKS", async () => {
    await withAuthServer(async (issuer) => {
      const discovery = await fetch(`${issuer}/.well-known/openid-configuration`);
      expect(discovery.status).toBe(200);
      const discoveryBody = await discovery.json() as {
        issuer: string;
        authorization_endpoint: string;
        token_endpoint: string;
        jwks_uri: string;
        scopes_supported: string[];
      };

      expect(discoveryBody).toMatchObject({
        issuer,
        authorization_endpoint: `${issuer}/auth`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
      });
      expect(discoveryBody.scopes_supported).toEqual(
        expect.arrayContaining(["openid", "profile", "email", "task_notes:read", "task_notes:write"]),
      );

      const jwks = await fetch(discoveryBody.jwks_uri);
      expect(jwks.status).toBe(200);
      await expect(jwks.json()).resolves.toMatchObject({
        keys: expect.any(Array),
      });
    });
  }, 10000);
});
