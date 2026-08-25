import { useLocation, useParams } from "@solidjs/router";

import { BlobViewer } from "../../components/blob-viewer.jsx";
import { getSpaceBlob } from "../../lib/spaces.js";
import { makeSpaceRef, makeSpaceRepoPath, useSpacesAuth } from "./context.jsx";

export const SpaceBlobView = () => {
  const auth = useSpacesAuth();
  const location = useLocation();
  const params = useParams();

  const space = () => makeSpaceRef(params.spaceAuthority!, params.spaceType!, params.skey!);
  const repo = () => params.spaceRepo!;
  const repoPath = () =>
    makeSpaceRepoPath(params.spaceAuthority!, params.spaceType!, params.skey!, params.spaceRepo!);
  const back = () => {
    const state = location.state as { from?: string; label?: string } | undefined;
    return {
      href: state?.from ?? `${repoPath()}#blobs`,
      label: state?.label ?? "Back to blobs",
    };
  };

  return (
    <BlobViewer
      cid={params.cid!}
      sourceKey={`${space()}\n${repo()}\n${params.cid}`}
      backHref={back().href}
      backLabel={back().label}
      fetchBlob={() => getSpaceBlob(auth(), space(), repo(), params.cid!)}
    />
  );
};
