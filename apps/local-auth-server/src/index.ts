import Provider from "oidc-provider";

const issuer = process.env.ISSUER ?? "http://127.0.0.1:4000";
const port = Number(process.env.PORT ?? "4000");

const DEV_USER = {
  accountId: "dev-user-1",
  email: "dev@example.local",
  password: "password",
};

const jwks = process.env.TEST_SIGNING_PRIVATE_JWK
  ? { keys: [JSON.parse(process.env.TEST_SIGNING_PRIVATE_JWK)] }
  : undefined;

const provider = new Provider(issuer, {
  jwks,
  clients: [
    {
      client_id: "task-notes-dev-client",
      redirect_uris: [
        "http://localhost:6274/oauth/callback",
        "http://127.0.0.1:6274/oauth/callback",
        "http://localhost:3000/callback",
      ],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "openid profile email task_notes:read task_notes:write",
    },
  ],
  pkce: {
    required: () => true,
  },
  scopes: [
    "openid",
    "profile",
    "email",
    "task_notes:read",
    "task_notes:write",
  ],
  features: {
    devInteractions: { enabled: false },
  },
  async findAccount(_ctx: unknown, id: string) {
    if (id !== DEV_USER.accountId) return undefined;
    return {
      accountId: DEV_USER.accountId,
      async claims() {
        return {
          sub: DEV_USER.accountId,
          email: DEV_USER.email,
        };
      },
    };
  },
} as never);

provider.proxy = true;

provider.listen(port, () => {
  console.log(`local-auth-server listening on ${issuer}`);
});
