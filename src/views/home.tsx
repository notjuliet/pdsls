import { A } from "@solidjs/router";

const Home = () => {
  return (
    <div class="w-21rem mt-4 flex flex-col break-words">
      <div class="mb-2">
        <p>
          Browse the public data on{" "}
          <a
            class="text-lightblue-500 hover:underline"
            href="https://atproto.com"
            target="_blank"
          >
            AT Protocol
          </a>
          .
        </p>
        <p>Login to manage records in your repository.</p>
        <p>
          <a
            href="https://github.com/bluesky-social/jetstream"
            class="text-lightblue-500 hover:underline"
            target="_blank"
          >
            Jetstream
          </a>{" "}
          viewer is available{" "}
          <A href="/jetstream" class="text-lightblue-500 hover:underline">
            here
          </A>
          .
        </p>
        <p>
          <A
            href="https://atproto.com/specs/sync#firehose"
            class="text-lightblue-500 hover:underline"
            target="_blank"
          >
            Firehose
          </A>{" "}
          streaming can be found{" "}
          <A href="/firehose" class="text-lightblue-500 hover:underline">
            here
          </A>
          .
        </p>
        <p>
          <A
            href="https://constellation.microcosm.blue"
            class="text-lightblue-500 hover:underline"
            target="_blank"
          >
            Backlinks
          </A>{" "}
          can be enabled in the settings.
        </p>
      </div>
      <p>Examples:</p>
      <div class="ml-2">
        <div>
          <span class="font-semibold text-orange-400">PDS</span>
          <div>
            <A href="/pds.moe" class="text-lightblue-500 hover:underline">
              https://pds.moe
            </A>
          </div>
        </div>
        <div>
          <span class="font-semibold text-orange-400">Repository</span>
          <div>
            <A
              href="/at://did:plc:vwzwgnygau7ed7b7wt5ux7y2"
              class="text-lightblue-500 hover:underline"
            >
              at://did:plc:vwzwgnygau7ed7b7wt5ux7y2
            </A>
          </div>
        </div>
        <div>
          <span class="font-semibold text-orange-400">Record</span>
          <div>
            <A
              href="/at://did:plc:oisofpd7lj26yvgiivf3lxsi/app.bsky.feed.post/3l2zpbbhuvw2h"
              class="text-lightblue-500 hover:underline"
            >
              at://did:plc:oisofpd7lj26yvgiivf3lxsi/app.bsky.feed.post/3l2zpbbhuvw2h
            </A>
          </div>
        </div>
      </div>
    </div>
  );
};

export { Home };
