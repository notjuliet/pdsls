/* @refresh reload */
import { Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";
import { Layout } from "./layout.tsx";
import "./styles/index.css";
import { ExploreToolView } from "./views/car/explore.tsx";
import { CarView } from "./views/car/index.tsx";
import { UnpackToolView } from "./views/car/unpack.tsx";
import { CollectionView } from "./views/collection.tsx";
import { Home } from "./views/home.tsx";
import { LabelView } from "./views/labels.tsx";
import { PdsView } from "./views/pds.tsx";
import { RecordView } from "./views/record.tsx";
import { RepoView } from "./views/repo.tsx";
import { Settings } from "./views/settings.tsx";
import { StreamView } from "./views/stream";

render(
  () => (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path={["/jetstream", "/firehose", "/spacedust"]} component={StreamView} />
      <Route path="/labels" component={LabelView} />
      <Route path="/car" component={CarView} />
      <Route path="/car/explore" component={ExploreToolView} />
      <Route path="/car/unpack" component={UnpackToolView} />
      <Route path="/settings" component={Settings} />
      <Route path="/:pds" component={PdsView} />
      <Route path="/:pds/:repo" component={RepoView} />
      <Route path="/:pds/:repo/:collection" component={CollectionView} />
      <Route path="/:pds/:repo/:collection/:rkey" component={RecordView} />
    </Router>
  ),
  document.getElementById("root") as HTMLElement,
);
