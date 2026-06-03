import { createRemoteJWKSet, jwtVerify } from "jose";
import { toolPolicies, type ToolName } from "./tool-policy.js";

export type JwtAuthConfig = {
  issuer: string;
  audience: string;
  jwksUrl: string;
};

export type AuthContext = {
  subject: string;
  scopes: string[];
};

export type AuthProvider = {
  requireToolScopes(toolName: ToolName): Promise<AuthContext>;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 401 | 403,
  ) {
    super(message);
  }
}

export async function verifyBearerToken(token: string, config: JwtAuthConfig) {
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  const verified = await jwtVerify(token, jwks, {
    issuer: config.issuer,
    audience: config.audience,
  });

  const subject = verified.payload.sub;
  if (!subject) {
    throw new AuthError("Token is missing sub.", 401);
  }

  const scopeClaim = verified.payload.scope;
  const scopes = typeof scopeClaim === "string" ? scopeClaim.split(/\s+/).filter(Boolean) : [];

  return { subject, scopes };
}

export function createRequestAuthProvider(authContext: AuthContext): AuthProvider {
  return {
    async requireToolScopes(toolName) {
      const policy = toolPolicies[toolName];
      const missingScopes = policy.requiredScopes.filter((scope) => !authContext.scopes.includes(scope));
      if (missingScopes.length > 0) {
        throw new AuthError(`Missing required scope: ${missingScopes.join(", ")}`, 403);
      }
      return authContext;
    },
  };
}

export function createDevelopmentAuthProvider(): AuthProvider {
  return createRequestAuthProvider({
    subject: "stdio-dev-user",
    scopes: ["task_notes:read", "task_notes:write"],
  });
}
