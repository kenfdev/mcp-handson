import { createRemoteJWKSet, jwtVerify } from "jose";

export type JwtAuthConfig = {
  issuer: string;
  audience: string;
  jwksUrl: string;
};

export async function verifyBearerToken(token: string, config: JwtAuthConfig) {
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  await jwtVerify(token, jwks, {
    issuer: config.issuer,
    audience: config.audience,
  });
}
