import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type EndpointResolver = (hostname: string) => Promise<ResolvedAddress[]>;

function privateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return true;
  }
  const [a, b] = octets as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function privateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:") ||
    (mapped?.[1] !== undefined && privateIpv4(mapped[1]))
  );
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !privateIpv4(address) : family === 6 ? !privateIpv6(address) : false;
}

const defaultResolver: EndpointResolver = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

export async function resolveSafeWebhookEndpoint(
  endpoint: string,
  resolver: EndpointResolver = defaultResolver,
): Promise<{ url: URL; addresses: ResolvedAddress[] }> {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
    throw new Error("Webhook endpoint must be an HTTPS URL without credentials");
  }
  if (url.port !== "" && url.port !== "443") {
    throw new Error("Webhook endpoint must use the standard HTTPS port");
  }
  const literalFamily = isIP(url.hostname.replace(/^\[|\]$/g, ""));
  const addresses =
    literalFamily === 0
      ? await resolver(url.hostname)
      : [{ address: url.hostname.replace(/^\[|\]$/g, ""), family: literalFamily }];
  if (addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address))) {
    throw new Error("Webhook endpoint resolves to a private or reserved address");
  }
  return { url, addresses };
}

export class SafeWebhookSender {
  readonly #resolver: EndpointResolver;
  readonly #timeoutMs: number;

  constructor(options: { resolver?: EndpointResolver; timeoutMs?: number } = {}) {
    this.#resolver = options.resolver ?? defaultResolver;
    this.#timeoutMs = options.timeoutMs ?? 10_000;
  }

  async send(input: {
    endpoint: string;
    headers: Record<string, string>;
    body: Uint8Array;
  }): Promise<{ status: number; body: Uint8Array }> {
    const { url, addresses } = await resolveSafeWebhookEndpoint(input.endpoint, this.#resolver);
    const selected = addresses[0]!;
    return new Promise((resolve, reject) => {
      const request = httpsRequest(
        url,
        {
          method: "POST",
          headers: { ...input.headers, "content-length": String(input.body.byteLength) },
          servername: url.hostname,
          lookup: (_hostname, _options, callback) =>
            callback(null, selected.address, selected.family as 4 | 6),
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 65_536) {
              request.destroy(new Error("Webhook response exceeded 64 KiB"));
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () =>
            resolve({ status: response.statusCode ?? 502, body: Buffer.concat(chunks) }),
          );
        },
      );
      request.setTimeout(this.#timeoutMs, () => request.destroy(new Error("Webhook request timed out")));
      request.once("error", reject);
      request.end(input.body);
    });
  }
}
