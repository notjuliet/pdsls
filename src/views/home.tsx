import { A } from "@solidjs/router";

const Home = () => {
  return (
    <div class="mt-4 flex w-full flex-col break-words">
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
        <p>
          You can optionally login to manage the records in your repository.
        </p>
        <p>
          A{" "}
          <a
            href="https://github.com/bluesky-social/jetstream"
            class="text-lightblue-500 hover:underline"
            target="_blank"
          >
            Jetstream
          </a>{" "}
          viewer is also available{" "}
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
          support can be found{" "}
          <A href="/firehose" class="text-lightblue-500 hover:underline">
            here
          </A>
          .
        </p>
      </div>
      <p>Search inputs allowed:</p>
      <div class="ml-2">
        <div>
          <span class="font-semibold text-orange-400">PDS URL</span>:
          <div>
            <A href="/pds.moe" class="text-lightblue-500 hover:underline">
              https://pds.moe
            </A>
          </div>
        </div>
        <div>
          <span class="font-semibold text-orange-400">AT URI</span> (at://
          optional, DID or handle alone also works):
          <div>
            <A
              href="/at/did:plc:oisofpd7lj26yvgiivf3lxsi/app.bsky.feed.post/3l2zpbbhuvw2h"
              class="text-lightblue-500 hover:underline"
            >
              at://did:plc:oisofpd7lj26yvgiivf3lxsi/app.bsky.feed.post/3l2zpbbhuvw2h
            </A>
          </div>
        </div>
        <div>
          <span class="font-semibold text-orange-400">Bluesky Link</span> (posts
          and profiles):
          <div>
            <A
              href="/at/did:plc:vwzwgnygau7ed7b7wt5ux7y2/app.bsky.feed.post/3khpasmu4ou2l"
              class="text-lightblue-500 hover:underline"
            >
              https://bsky.app/profile/retr0.id/post/3khpasmu4ou2l
            </A>
          </div>
        </div>
      </div>
    </div>
  );
};

export { Home };
