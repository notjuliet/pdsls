export type AppUrl = `${string}.${string}` | `localhost:${number}`;

enum App {
  Bluesky,
  Tangled,
  Pinksea,
  Blento,
  Popfeed,
  GreenGale,
  SonaskyREF,
  Parfait,
}

export const appList: Record<AppUrl, App> = {
  "localhost:19006": App.Bluesky,
  "blacksky.community": App.Bluesky,
  "bsky.app": App.Bluesky,
  "catsky.social": App.Bluesky,
  "deer.social": App.Bluesky,
  "deer-social-ayla.pages.dev": App.Bluesky,
  "deer.aylac.top": App.Bluesky,
  "main.bsky.dev": App.Bluesky,
  "witchsky.app": App.Bluesky,
  "reddwarf.app": App.Bluesky,
  "mu.social": App.Bluesky,
  "cope.works": App.Bluesky,
  "parfait.social": App.Parfait,
  "tangled.org": App.Tangled,
  "pinksea.art": App.Pinksea,
  "blento.app": App.Blento,
  "popfeed.social": App.Popfeed,
  "greengale.app": App.GreenGale,
  "ref.sonasky.app": App.SonaskyREF,
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
      return `at://${user}/sh.tangled.repo/${path[1]}`;
    }

    return `at://${user}`;
  },
  [App.Pinksea]: (path) => {
    if (path.length === 3) {
      return `at://${path[0]}/com.shinolabs.pinksea.oekaki/${path[2]}`;
    }

    return `at://${path[0]}`;
  },
  [App.Blento]: (path) => {
    return `at://${path[0]}/app.blento.card`;
  },
  [App.Popfeed]: (path) => {
    if (path[0] === "profile" && path[1]) {
      return `at://${path[1]}/social.popfeed.actor.profile/self`;
    }
    if (
      (path[0] === "review" || path[0] === "list") &&
      path[1] === "at:" &&
      path[2] &&
      path[3] &&
      path[4]
    ) {
      return `at://${path[2]}/${path[3]}/${path[4]}`;
    }
    return `at://${path[1]}`;
  },
  [App.GreenGale]: (path) => {
    return `at://${path[0]}/site.standard.document/${path[1]}`;
  },
  [App.SonaskyREF]: (path) => {
    if (path.length === 3 && path[0] === "profile") {
      return `at://${path[1]}/app.sonasky.ref/${path[2]}`;
    }
    return `at://${path[1]}`;
  },
  // Bluesky's pages without the /profile prefix: /juliet.paris/post/3abc.
  [App.Parfait]: (path) => {
    const parts = path.filter(Boolean).map((part) => decodeURIComponent(part));
    if (parts[0] === "starter-pack" || parts[0] === "start") {
      return parts[2]
        ? `at://${parts[1]}/app.bsky.graph.starterpack/${parts[2]}`
        : `at://${parts[1]}`;
    }
    const [user, type, rkey] = parts;
    const collection = {
      post: "app.bsky.feed.post",
      lists: "app.bsky.graph.list",
      feed: "app.bsky.feed.generator",
    }[type];
    return collection && rkey ? `at://${user}/${collection}/${rkey}` : `at://${user}`;
  },
};
