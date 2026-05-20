import { JSX, Show, Suspense } from "solid-js";

import { Spinner } from "./spinner.jsx";

export const NestedLayout = (props: {
  key: string | undefined;
  hasChild: boolean;
  view: () => JSX.Element;
  children: JSX.Element;
}) => (
  <Show keyed when={props.key}>
    {(_) => (
      <>
        <Show when={props.hasChild}>
          <Suspense fallback={<Spinner />}>{props.children}</Suspense>
        </Show>
        {props.view()}
      </>
    )}
  </Show>
);
