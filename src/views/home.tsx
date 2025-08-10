import { A } from "@solidjs/router";
import Tooltip from "../components/tooltip";

const Home = () => {
  return (
    <div class="w-21rem sm:w-24rem mt-4 flex flex-col gap-2 break-words">
      <div>
        <p>
          Browse the public data on{" "}
          <a class="text-blue-400 hover:underline" href="https://atproto.com" target="_blank">
            AT Protocol
          </a>
          .
        </p>
        <p>Login to manage records in your repository.</p>
        <p>
          <A href="/jetstream" class="text-blue-400 hover:underline">
            Jetstream
          </A>{" "}
          and{" "}
          <A href="/firehose" class="text-blue-400 hover:underline">
            firehose
          </A>{" "}
          streaming.
        </p>
        <p>
          <A
            href="https://constellation.microcosm.blue"
            class="text-blue-400 hover:underline"
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
          <A href="/pds.kelinci.net" class="text-sm text-blue-400 hover:underline sm:text-base">
            https://pds.kelinci.net
          </A>
        </div>
        <div>
          <A
            href="/at://did:plc:vwzwgnygau7ed7b7wt5ux7y2"
            class="text-sm text-blue-400 hover:underline sm:text-base"
          >
            at://did:plc:vwzwgnygau7ed7b7wt5ux7y2
          </A>
        </div>
        <div>
          <A
            href="/at://did:plc:oisofpd7lj26yvgiivf3lxsi/app.bsky.feed.post/3l2zpbbhuvw2h"
            class="text-sm text-blue-400 hover:underline sm:text-base"
          >
            at://hailey.at/app.bsky.feed.post/3l2zpbbhuvw2h
          </A>
        </div>
        <div>
          <A
            href="/at://did:plc:wkoofae5uytcm7bjncmev6n6/labels"
            class="text-sm text-blue-400 hover:underline sm:text-base"
          >
            at://did:plc:wkoofae5uytcm7bjncmev6n6/labels
          </A>
        </div>
      </div>
      <div class="flex gap-2">
        <Tooltip text="GitHub">
          <A href="https://github.com/notjuliet/pdsls" target="_blank">
            <div class="i-lucide-github text-xl" />
          </A>
        </Tooltip>
        <Tooltip text="Tangled">
          <A href="https://tangled.sh/@pdsls.dev/pdsls/" target="_blank">
            <div class="i-lucide-line-squiggle text-xl" />
          </A>
        </Tooltip>
        <Tooltip text="Bluesky">
          <A href="https://bsky.app/profile/did:plc:6q5daed5gutiyerimlrnojnz" target="_blank">
            <div class="i-tabler-brand-bluesky text-xl" />
          </A>
        </Tooltip>
        <Tooltip text="Donate on Ko-fi">
          <A href="https://ko-fi.com/notjuliet" target="_blank">
            <div class="i-lucide-coffee text-xl" />
          </A>
        </Tooltip>
      </div>
    </div>
  );
};

export { Home };
