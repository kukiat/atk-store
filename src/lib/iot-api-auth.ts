import "server-only";

export class IotApiAuthorizationError extends Error {
  constructor() {
    super("Invalid IOT API key");
    this.name = "IotApiAuthorizationError";
  }
}

export function requireIotApiKey(request: Request) {
  const expected = process.env.IOT_API_KEY?.trim();
  if (!expected) throw new IotApiAuthorizationError();

  const apiKey = request.headers.get("x-iot-api-key")?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;

  if (apiKey !== expected && bearer !== expected) {
    throw new IotApiAuthorizationError();
  }
}
