// courtesy of the best 🐇, my lovely sister mary
import Hls from "hls.js";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";

export interface VideoPlayerProps {
  /** Expected to be static */
  did: string;
  cid: string;
}

const VideoPlayer = ({ did, cid }: VideoPlayerProps) => {
  const [playing, setPlaying] = createSignal(false);
  const [error, setError] = createSignal(false);

  const hls = new Hls({
    capLevelToPlayerSize: true,
    startLevel: 1,
    xhrSetup(xhr, urlString) {
      const url = new URL(urlString);

      // Just in case it fails, we'll remove `session_id` everywhere
      url.searchParams.delete("session_id");

      xhr.open("get", url.toString());
    },
  });

  onCleanup(() => hls.destroy());

  hls.loadSource(`https://video.cdn.bsky.app/hls/${did}/${cid}/playlist.m3u8`);
  hls.on(Hls.Events.ERROR, () => setError(true));

  return (
    <div class="max-w-xs">
      <Show when={!error()}>
        <video
          ref={(node) => {
            hls.attachMedia(node);

            createEffect(() => {
              if (!playing()) {
                return;
              }

              const observer = new IntersectionObserver(
                (entries) => {
                  const entry = entries[0];
                  if (!entry.isIntersecting) {
                    node.pause();
                  }
                },
                { threshold: 0.5 },
              );

              onCleanup(() => observer.disconnect());

              observer.observe(node);
            });
          }}
          controls
          playsinline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(ev) => {
            const video = ev.currentTarget;

            const hasAudio =
              // @ts-expect-error: Mozilla-specific
              video.mozHasAudio ||
              // @ts-expect-error: WebKit/Blink-specific
              !!video.webkitAudioDecodedByteCount ||
              // @ts-expect-error: WebKit-specific
              !!(video.audioTracks && video.audioTracks.length);

            video.loop = !hasAudio || video.duration <= 6;
          }}
        />
      </Show>
    </div>
  );
};

export default VideoPlayer;
