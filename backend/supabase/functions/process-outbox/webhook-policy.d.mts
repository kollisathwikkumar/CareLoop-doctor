export function parseAllowedHosts(rawAllowlist: string | undefined): ReadonlySet<string>;
export function resolveWebhookTarget(rawEndpoint: string | undefined, allowedHosts: ReadonlySet<string>): URL;
