/**
 * The files that name the site's own address. The worker makes them per request from the host
 * it was reached on, so one deployment serves every domain.
 */

export const OAUTH_SCOPE =
  "atproto repo:*?action=create repo:*?action=update repo:*?action=delete blob:*/* space:*?authority=*&action=read space:*?authority=*&collection=*&action=create&action=update&action=delete space:*?manage=create&manage=update&manage=delete";

export const OAUTH_METADATA_PATH = "/oauth-client-metadata.json";
export const OPENSEARCH_PATH = "/opensearch.xml";

export const oauthClientId = (origin: string) => `${origin}${OAUTH_METADATA_PATH}`;
export const oauthRedirectUri = (origin: string) => `${origin}/`;

export const oauthClientMetadata = (origin: string) => ({
  client_id: oauthClientId(origin),
  client_name: "PDSls",
  client_uri: origin,
  logo_uri: `${origin}/favicon.ico`,
  redirect_uris: [oauthRedirectUri(origin)],
  scope: OAUTH_SCOPE,
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
  application_type: "web",
  dpop_bound_access_tokens: true,
});

export const opensearchXml = (origin: string) => `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/" xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <ShortName>PDSls</ShortName>
  <Description>Search the Atmosphere</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">${origin}/favicon.ico</Image>
  <Url type="text/html" method="get" template="${origin}/?q={searchTerms}"/>
  <moz:SearchForm>${origin}</moz:SearchForm>
</OpenSearchDescription>`;
