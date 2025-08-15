import { A } from "@solidjs/router";
import Tooltip from "../components/tooltip";

const Home = () => {
  return (
    <div class="w-21rem sm:w-24rem mt-4 flex flex-col gap-2 break-words">
      <div>
        <div>
          <span class="font-semibold">AT Protocol Explorer</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="i-lucide-search" />
          <span>
            Browse the public data on{" "}
            <a class="text-blue-400 hover:underline" href="https://atproto.com" target="_blank">
              atproto
            </a>
            .
          </span>
        </div>
        <div class="flex items-center gap-1">
          <div class="i-lucide-user-round" />
          <span>Login to manage records in your repo.</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="i-lucide-radio-tower" />
          <A href="/jetstream" class="text-blue-400 hover:underline">
            Jetstream
          </A>{" "}
          and{" "}
          <A href="/firehose" class="text-blue-400 hover:underline">
            firehose
          </A>{" "}
          streaming.
        </div>
        <div class="flex items-center gap-1">
          <div class="i-lucide-send-to-back" />
          <span>
            Backlinks support with{" "}
            <A
              href="https://constellation.microcosm.blue"
              class="text-blue-400 hover:underline"
              target="_blank"
            >
              constellation
            </A>
            .
          </span>
        </div>
      </div>
      <div>
        <span class="font-semibold">Examples</span>
        <div class="flex items-center gap-1">
          <div class="i-lucide-server" />
          <A href="/pds.kelinci.net" class="text-sm text-blue-400 hover:underline sm:text-base">
            https://pds.kelinci.net
          </A>
        </div>
        <div class="flex items-center gap-1">
          <div class="i-lucide-at-sign" />
          <A
            href="/at://did:plc:vwzwgnygau7ed7b7wt5ux7y2"
            class="text-sm text-blue-400 hover:underline sm:text-base"
          >
            at://did:plc:vwzwgnygau7ed7b7wt5ux7y2
          </A>
        </div>
        <div class="flex items-center gap-1">
          <div class="i-lucide-file-json shrink-0" />
          <A
            href="/at://did:plc:oisofpd7lj26yvgiivf3lxsi/app.bsky.actor.profile/self"
            class="text-sm text-blue-400 hover:underline sm:text-base"
          >
            at://hailey.at/app.bsky.actor.profile/self
          </A>
        </div>
        <div class="flex items-center gap-1">
          <div class="i-lucide-tag" />
          <A
            href="/at://did:plc:wkoofae5uytcm7bjncmev6n6/labels"
            class="text-sm text-blue-400 hover:underline sm:text-base"
          >
            at://did:plc:wkoofae5uytcm7bjncmev6n6/labels
          </A>
        </div>
      </div>
      <div class="flex justify-between">
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
        </div>
        <div class="flex gap-2">
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
    </div>
  );
};

export { Home };
