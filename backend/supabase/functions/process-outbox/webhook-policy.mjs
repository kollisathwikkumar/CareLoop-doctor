const DNS_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const IPV4_LITERAL = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_LITERAL = /^\[[0-9a-f:.]+\]$/i;
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.test', '.invalid'];

function isDisallowedHostname(hostname) {
  return hostname === 'localhost'
    || hostname.endsWith('.')
    || IPV4_LITERAL.test(hostname)
    || IPV6_LITERAL.test(hostname)
    || hostname.includes(':')
    || LOCAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/** @param {string | undefined} rawAllowlist @returns {ReadonlySet<string>} */
export function parseAllowedHosts(rawAllowlist) {
  if (typeof rawAllowlist !== 'string' || rawAllowlist.trim().length === 0) {
    throw new Error('NOTIFICATION_WEBHOOK_ALLOWED_HOSTS must contain exact provider hostnames.');
  }

  const entries = rawAllowlist.split(',').map((entry) => entry.trim().toLowerCase());
  if (entries.some((entry) => entry.length === 0) || new Set(entries).size !== entries.length) {
    throw new Error('NOTIFICATION_WEBHOOK_ALLOWED_HOSTS contains an empty or duplicate hostname.');
  }

  for (const hostname of entries) {
    const labels = hostname.split('.');
    if (hostname.includes('*') || labels.length < 2 || isDisallowedHostname(hostname)
      || labels.some((label) => !DNS_LABEL.test(label))
      || !/[a-z]/i.test(labels.at(-1) ?? '')) {
      throw new Error('NOTIFICATION_WEBHOOK_ALLOWED_HOSTS must contain public DNS hostnames without wildcards.');
    }
    let normalized;
    try {
      normalized = new URL(`https://${hostname}`).hostname.toLowerCase();
    } catch {
      throw new Error('NOTIFICATION_WEBHOOK_ALLOWED_HOSTS contains an invalid hostname.');
    }
    if (normalized !== hostname) {
      throw new Error('NOTIFICATION_WEBHOOK_ALLOWED_HOSTS hostnames must use canonical DNS form.');
    }
  }

  return new Set(entries);
}

/** @param {string | undefined} rawEndpoint @param {ReadonlySet<string>} allowedHosts @returns {URL} */
export function resolveWebhookTarget(rawEndpoint, allowedHosts) {
  if (typeof rawEndpoint !== 'string' || rawEndpoint.length === 0 || rawEndpoint.length > 2048) {
    throw new Error('NOTIFICATION_WEBHOOK_URL must be a valid HTTPS endpoint.');
  }

  let endpoint;
  try {
    endpoint = new URL(rawEndpoint);
  } catch {
    throw new Error('NOTIFICATION_WEBHOOK_URL must be a valid HTTPS endpoint.');
  }

  const hostname = endpoint.hostname.toLowerCase();
  if (endpoint.protocol !== 'https:' || endpoint.port !== '' || endpoint.username !== ''
    || endpoint.password !== '' || endpoint.hash !== '') {
    throw new Error('NOTIFICATION_WEBHOOK_URL must use HTTPS on the default port without credentials or fragments.');
  }
  if (isDisallowedHostname(hostname) || !allowedHosts.has(hostname)) {
    throw new Error('NOTIFICATION_WEBHOOK_URL hostname is not in the configured allowlist.');
  }

  return endpoint;
}
