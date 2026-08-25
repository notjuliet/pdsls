import { useLocation, useParams } from "@solidjs/router";

import { BlobViewer } from "../../components/blob-viewer.jsx";
import { useRepo } from "../../lib/repo-context.jsx";

export const BlobDebugView = () => {
  const params = useParams();
  const location = useLocation();
  const repo = useRepo();

  const back = () => {
    const state = location.state as { from?: string; label?: string } | undefined;
    return {
      href: state?.from ?? `/at://${params.repo}#blobs`,
      label: state?.label ?? "Back to blobs",
    };
  };

  const blobUrl = () =>
    `${repo.pds()}/xrpc/com.atproto.sync.getBlob?did=${params.repo}&cid=${params.cid}`;

  const fetchBlob = async () => {
    const response = await fetch(blobUrl());
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.blob();
  };

  const inspectBlob = async () => {
    const response = await fetch(blobUrl(), { method: "HEAD" });
    if (!response.ok) return {};
    const contentLength = response.headers.get("content-length");
    return {
      size: contentLength ? parseInt(contentLength, 10) : undefined,
      mimeType: response.headers.get("content-type") ?? undefined,
    };
  };

  return (
    <BlobViewer
      cid={params.cid!}
      sourceKey={`${repo.pds()}\n${params.repo}\n${params.cid}`}
      backHref={back().href}
      backLabel={back().label}
      fetchBlob={fetchBlob}
      inspectBlob={inspectBlob}
      rawUrl={blobUrl()}
      unavailableMessage={repo.pds() ? undefined : "PDS unavailable for this repo."}
    />
  );
};
