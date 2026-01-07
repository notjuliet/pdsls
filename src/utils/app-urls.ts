export type AppUrl = `${string}.${string}` | `localhost:${number}`;

export enum App {
  Bluesky,
  Tangled,
  Frontpage,
  Pinksea,
  Linkat,
}

export const appName = {
  [App.Bluesky]: "Bluesky",
  [App.Tangled]: "Tangled",
  [App.Frontpage]: "Frontpage",
  [App.Pinksea]: "Pinksea",
  [App.Linkat]: "Linkat",
};

export const appList: Record<AppUrl, App> = {
  "localhost:19006": App.Bluesky,
  "blacksky.community": App.Bluesky,
  "bsky.app": App.Bluesky,
  "catsky.social": App.Bluesky,
  "deer.aylac.top": App.Bluesky,
  "deer-social-ayla.pages.dev": App.Bluesky,
  "deer.social": App.Bluesky,
  "main.bsky.dev": App.Bluesky,
  "social.daniela.lol": App.Bluesky,
  "tangled.org": App.Tangled,
  "frontpage.fyi": App.Frontpage,
  "pinksea.art": App.Pinksea,
  "linkat.blue": App.Linkat,
};

export const appHandleLink: Record<App, (url: string[]) => string> = {
  [App.Bluesky]: (path) => {
    const baseType = path[0];
    const user = path[1];

    if (baseType === "profile") {
      if (path[2]) {
        const type = path[2];
        const rkey = path[3];

        if (type === "post") {
          return `at://${user}/app.bsky.feed.post/${rkey}`;
        } else if (type === "lists") {
          return `at://${user}/app.bsky.graph.list/${rkey}`;
        } else if (type === "feed") {
          return `at://${user}/app.bsky.feed.generator/${rkey}`;
        } else if (type === "follows") {
          return `at://${user}/app.bsky.graph.follow/${rkey}`;
        }
      } else {
        return `at://${user}`;
      }
    } else if (baseType === "starter-pack") {
      return `at://${user}/app.bsky.graph.starterpack/${path[2]}`;
    }
    return `at://${user}`;
  },
  [App.Tangled]: (path) => {
    if (path[0] === "strings") {
      return `at://${path[1]}/sh.tangled.string/${path[2]}`;
    }

    let query: string | undefined;
    if (path[path.length - 1].includes("?")) {
      const split = path[path.length - 1].split("?");
      query = split[1];
      path[path.length - 1] = split[0];
    }

    const user = path[0].replace("@", "");

    if (path.length === 1) {
      if (query === "tab=repos") {
        return `at://${user}/sh.tangled.repo`;
      } else if (query === "tab=starred") {
        return `at://${user}/sh.tangled.feed.star`;
      } else if (query === "tab=strings") {
        return `at://${user}/sh.tangled.string`;
      }
    } else if (path.length === 2) {
      // no way to convert the repo name to an rkey afaik
      // same reason why there's nothing related to issues in here
      return `at://${user}/sh.tangled.repo`;
    }

    return `at://${user}`;
  },
  [App.Frontpage]: (path) => {
    if (path.length === 3) {
      return `at://${path[1]}/fyi.unravel.frontpage.post/${path[2]}`;
    } else if (path.length === 5) {
      return `at://${path[3]}/fyi.unravel.frontpage.comment/${path[4]}`;
    }

    return `at://${path[0]}`;
  },
  [App.Pinksea]: (path) => {
    if (path.length === 3) {
      return `at://${path[0]}/com.shinolabs.pinksea.oekaki/${path[2]}`;
    }

    return `at://${path[0]}`;
  },
  [App.Linkat]: (path) => `at://${path[0]}/blue.linkat.board/self`,
};
