import { onMount } from "solid-js";
import { pds } from "./navbar";

export interface VideoPlayerProps {
  did: string;
  cid: string;
  onLoad: () => void;
}

const VideoPlayer = (props: VideoPlayerProps) => {
  let video!: HTMLVideoElement;

  onMount(async () => {
    // thanks bf <3
    const res = await fetch(
      `https://${pds()}/xrpc/com.atproto.sync.getBlob?did=${props.did}&cid=${props.cid}`,
    );
    if (!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (video) video.src = url;
  });

  return (
    <video
      ref={video}
      class="max-h-80 max-w-[20rem]"
      controls
      playsinline
      onLoadedData={props.onLoad}
    >
      <source type="video/mp4" />
    </video>
  );
};

export default VideoPlayer;
