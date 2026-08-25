/* @refresh reload */
import { Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";

import { Layout } from "./layout.tsx";

import "./styles/index.css";
import { CarView } from "./views/car/explore.tsx";
import { CollectionLayout } from "./views/collection.tsx";
import { Home } from "./views/home.tsx";
import { LabelView } from "./views/labels.tsx";
import { LexiconRedirect } from "./views/lexicon-redirect.tsx";
import { PdsLayout } from "./views/pds.tsx";
import { RecordView } from "./views/record.tsx";
import { BlobDebugView } from "./views/repo/blob-debug.tsx";
import { RepoLayout, repoPreload } from "./views/repo/index.tsx";
import { Settings } from "./views/settings.tsx";
import {
  LegacySpaceRedirect,
  SpaceBlobView,
  SpaceCollectionLayout,
  SpaceRecordView,
  SpaceRepoLayout,
  SpaceRouteLayout,
  SpacesLayout,
} from "./views/spaces/index.tsx";
import { StreamView } from "./views/stream";

render(
  () => (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path={["/jetstream", "/firehose", "/spacedust"]} component={StreamView} />
      <Route path="/labels" component={LabelView} />
      <Route path="/car" component={CarView} />
      <Route path="/spaces" component={SpacesLayout} />
      <Route
        path="/spaces/:spaceAuthority/space/:spaceType/:skey/*spaceRest"
        component={LegacySpaceRedirect}
      />
      <Route
        path="/:pds/:spaceAuthority/space/:spaceType/:skey"
        matchFilters={{ pds: ["at:"] }}
        component={SpaceRouteLayout}
      >
        <Route path="/" />
        <Route path="/:spaceRepo" component={SpaceRepoLayout}>
          <Route path="/" />
          <Route path="/blob/:cid" component={SpaceBlobView} />
          <Route path="/:collection" component={SpaceCollectionLayout}>
            <Route path="/" />
            <Route path="/:rkey" component={SpaceRecordView} />
          </Route>
        </Route>
      </Route>
      <Route path="/settings" component={Settings} />
      <Route path="/lexicon/:nsid" component={LexiconRedirect} />
      <Route path="/:pds" component={PdsLayout}>
        <Route path="/" />
        <Route path="/:repo" component={RepoLayout} preload={repoPreload}>
          <Route path="/" />
          <Route path="/blob/:cid" component={BlobDebugView} />
          <Route path="/:collection" component={CollectionLayout}>
            <Route path="/" />
            <Route path="/:rkey" component={RecordView} />
          </Route>
        </Route>
      </Route>
    </Router>
  ),
  document.getElementById("root") as HTMLElement,
);
