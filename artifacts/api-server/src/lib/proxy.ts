/**
 * Residential proxy configuration for streaming provider requests.
 *
 * Set any of these environment variables to enable proxying:
 *   PROXY_URL=http://user:pass@host:port
 *   HTTPS_PROXY=http://user:pass@host:port
 *   HTTP_PROXY=http://user:pass@host:port
 *
 * Proxy is applied only to outbound streaming provider requests (not AniList / Jikan).
 * Falls back to direct connection when no proxy is configured.
 */

import type { AxiosProxyConfig } from "axios";
import { logger } from "./logger";

export interface ProxyConfig {
  proxy: AxiosProxyConfig;
}

let _cached: ProxyConfig | null | false = false; // false = uninitialised

export function getProxyConfig(): ProxyConfig | null {
  if (_cached !== false) return _cached;

  const raw =
    process.env.PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    "";

  if (!raw) {
    _cached = null;
    return null;
  }

  try {
    const url = new URL(raw);
    const config: ProxyConfig = {
      proxy: {
        protocol: url.protocol.replace(":", "") || "http",
        host: url.hostname,
        port: Number(url.port) || (url.protocol === "https:" ? 443 : 8080),
        ...(url.username
          ? { auth: { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) } }
          : {}),
      },
    };
    logger.info(
      { host: url.hostname, port: config.proxy.port },
      "Residential proxy configured for streaming requests"
    );
    _cached = config;
    return config;
  } catch (err) {
    logger.warn({ raw, err: String(err) }, "Failed to parse PROXY_URL — using direct connection");
    _cached = null;
    return null;
  }
}
