/* @refresh reload */
import { render } from "solid-js/web";
import "./styles/index.css";
import { Route, Router } from "@solidjs/router";
import { Layout } from "./layout.tsx";
import { Home } from "./views/home.tsx";
import { PdsView } from "./views/pds.tsx";
import { RepoView } from "./views/repo.tsx";
import { CollectionView } from "./views/collection.tsx";
import { LabelView } from "./views/labels.tsx";
import { StreamView } from "./views/stream.tsx";
import { RecordView } from "./views/record.tsx";
import { Settings } from "./views/settings.tsx";

render(
  () => (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path={["/jetstream", "/firehose"]} component={StreamView} />
      <Route path="/settings" component={Settings} />
      <Route path="/:pds" component={PdsView} />
      <Route path="/:pds/:repo" component={RepoView} />
      <Route path="/:pds/:repo/labels" component={LabelView} />
      <Route path="/:pds/:repo/:collection" component={CollectionView} />
      <Route path="/:pds/:repo/:collection/:rkey" component={RecordView} />
    </Router>
  ),
  document.getElementById("root") as HTMLElement,
);
