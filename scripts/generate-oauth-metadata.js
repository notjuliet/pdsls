import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const domain = process.env.APP_DOMAIN || "pdsls.dev";
const protocol = process.env.APP_PROTOCOL || "https";
const baseUrl = `${protocol}://${domain}`;

const metadata = {
  client_id: `${baseUrl}/oauth-client-metadata.json`,
  client_name: "PDSls",
  client_uri: baseUrl,
  logo_uri: `${baseUrl}/favicon.ico`,
  redirect_uris: [`${baseUrl}/`],
  scope: "atproto repo:*?action=create repo:*?action=update repo:*?action=delete blob:*/*",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
  application_type: "web",
  dpop_bound_access_tokens: true,
};

const outputPath = `${__dirname}/../public/oauth-client-metadata.json`;

try {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(metadata, null, 2) + "\n");
  console.log(`Generated OAuth metadata for ${baseUrl}`);
} catch (error) {
  console.error("Failed to generate OAuth metadata:", error);
  process.exit(1);
}
