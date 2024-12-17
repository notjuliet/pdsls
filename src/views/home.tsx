import { Component } from "solid-js";

const Home: Component = () => {
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
          You can optionally{" "}
          <a href="/login" class="text-lightblue-500 hover:underline">
            login
          </a>{" "}
          to manage the records in your repository.
        </p>
      </div>
      <p>Search inputs allowed:</p>
      <div class="ml-2">
        <div>
          <span class="font-semibold text-orange-400">PDS URL</span> (https://
          required):
          <div>
            <a href="/pds.bsky.mom" class="text-lightblue-500 hover:underline">
              https://pds.bsky.mom
            </a>
          </div>
        </div>
        <div>
          <span class="font-semibold text-orange-400">AT URI</span> (at://
          optional, DID or handle alone also works):
          <div>
            <a
              href="/at/did:plc:oisofpd7lj26yvgiivf3lxsi/app.bsky.feed.post/3l2zpbbhuvw2h"
              class="text-lightblue-500 hover:underline"
            >
              at://did:plc:oisofpd7lj26yvgiivf3lxsi/app.bsky.feed.post/3l2zpbbhuvw2h
            </a>
          </div>
        </div>
        <div>
          <span class="font-semibold text-orange-400">Bluesky Link</span> (posts
          and profiles):
          <div>
            <a
              href="/at/did:plc:ia76kvnndjutgedggx2ibrem/app.bsky.feed.post/3kenlltlvus2u"
              class="text-lightblue-500 hover:underline"
            >
              https://bsky.app/profile/mary.my.id/post/3kenlltlvus2u
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export { Home };
