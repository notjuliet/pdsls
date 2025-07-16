import { A } from "@solidjs/router";
import { Show } from "solid-js";

const Home = () => {
  return (
    <div class="w-21rem sm:w-23rem mt-4 flex flex-col gap-2 break-words">
      <div>
        <p>
          Browse the public data on{" "}
          <a class="text-sky-500 hover:underline" href="https://atproto.com" target="_blank">
            AT Protocol
          </a>
          .
        </p>
        <p>Login to manage records in your repository.</p>
        <p>
          <A href="/jetstream" class="text-sky-500 hover:underline">
            Jetstream
          </A>{" "}
          and{" "}
          <A href="/firehose" class="text-sky-500 hover:underline">
            firehose
          </A>{" "}
          support.
        </p>
        <p>
          <A
            href="https://constellation.microcosm.blue"
            class="text-sky-500 hover:underline"
            target="_blank"
          >
            Backlinks
          </A>{" "}
          can be enabled in the settings.
        </p>
      </div>
      <div>
        <span class="font-semibold">Examples</span>
        <div>
          <A href="/pds.kelinci.net" class="text-sm text-sky-500 hover:underline sm:text-base">
            https://pds.kelinci.net
          </A>
        </div>
        <div>
          <A
            href="/at://did:plc:vwzwgnygau7ed7b7wt5ux7y2"
            class="text-sm text-sky-500 hover:underline sm:text-base"
          >
            at://did:plc:vwzwgnygau7ed7b7wt5ux7y2
          </A>
        </div>
        <div>
          <A
            href="/at://did:plc:oisofpd7lj26yvgiivf3lxsi/app.bsky.feed.post/3l2zpbbhuvw2h"
            class="text-sm text-sky-500 hover:underline sm:text-base"
          >
            at://hailey.at/app.bsky.feed.post/3l2zpbbhuvw2h
          </A>
        </div>
      </div>
      <div>
        <p>
          <span class="font-semibold">GitHub</span>:{" "}
          <A
            href="https://github.com/notjuliet/pdsls"
            target="_blank"
            class="text-sky-500 hover:underline"
          >
            notjuliet/pdsls
          </A>
        </p>
      </div>
      <Show when={localStorage.kawaii === "true"}>
        <p>
          Blue-tan art by{" "}
          <a
            href="https://bsky.app/profile/did:plc:zoujtrsqvk3w4n5svsqtj3kg"
            target="_blank"
            class="text-sky-500 hover:underline"
          >
            nico ღ
          </a>
        </p>
      </Show>
      <div>
        <i>
          Proudly powered by{" "}
          <A href="https://github.com/mary-ext/atcute" target="_blank" class="hover:underline">
            atcute
          </A>
        </i>
      </div>
    </div>
  );
};

export { Home };
