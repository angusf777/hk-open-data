export function callerToken(authorization: string | null): string | undefined {
  if (authorization === null) return undefined;
  const match = /^Bearer ([^\s]+)$/i.exec(authorization.trim());
  if (match?.[1] === undefined) {
    throw new Error("Authorization must contain one bearer token");
  }
  return match[1];
}
