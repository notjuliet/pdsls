import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const domain = process.env.APP_DOMAIN || "pdsls.dev";
const protocol = process.env.APP_PROTOCOL || "https";
const baseUrl = `${protocol}://${domain}`;

const configs = {
  oauth: {
    name: "OAuth metadata",
    path: `${__dirname}/../public/oauth-client-metadata.json`,
    content:
      JSON.stringify(
        {
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
        },
        null,
        2,
      ) + "\n",
  },
  opensearch: {
    name: "OpenSearch XML",
    path: `${__dirname}/../public/opensearch.xml`,
    content: `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/" xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <ShortName>PDSls</ShortName>
  <Description>Search the Atmosphere</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">${baseUrl}/favicon.ico</Image>
  <Url type="text/html" method="get" template="${baseUrl}/?q={searchTerms}"/>
  <moz:SearchForm>${baseUrl}</moz:SearchForm>
</OpenSearchDescription>`,
  },
};

try {
  Object.values(configs).forEach((config) => {
    mkdirSync(dirname(config.path), { recursive: true });
    writeFileSync(config.path, config.content);
    console.log(`Generated ${config.name} for ${baseUrl}`);
  });
} catch (error) {
  console.error("Failed to generate files:", error);
  process.exit(1);
}
