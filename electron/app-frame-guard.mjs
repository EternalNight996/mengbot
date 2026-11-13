// A chat app runs in a srcdoc iframe sandboxed with "allow-scripts allow-forms", so its origin is opaque.
// The sandbox stops it from navigating the window or opening one, but not from navigating itself, which
// would fetch any URL: a subframe whose origin is opaque may only load its own document, about:srcdoc or
// about:blank.
//
// Electron 43.7.9: a frame's self-navigation fires will-frame-navigate with frame.origin === "null" and an
// empty frame.url, and preventDefault() stops it before any request leaves.
//
// The one exception is the page the person pinned (components/WebPanelPage.tsx): it is framed under a name
// only main makes, so an app frame — which never learns that name — cannot pass for it. Such a frame may load
// web pages (the page the person chose, and where its own links lead) and nothing else.

const OWN_DOCUMENTS = new Set(["about:srcdoc", "about:blank"]);
const WEB_PAGE = /^https?:\/\//i;

/**
 * @param {{ isMainFrame?: boolean, url?: string, frame?: { origin?: string, name?: string } | null } | null | undefined} details
 * @param {string} [panelFrameName] the frame name main gave the pinned page's iframe (electron/main.mjs)
 * @returns {boolean} false when the navigation must be cancelled
 */
export function appFrameNavigationAllowed(details, panelFrameName = "") {
  if (!details || details.isMainFrame) return true;
  // A link to a fragment of the page itself stays inside its own document.
  const url = typeof details.url === "string" ? details.url : "";
  if (OWN_DOCUMENTS.has(url.split("#")[0])) return true;
  let origin;
  let name = "";
  try {
    origin = details.frame?.origin;
    name = typeof details.frame?.name === "string" ? details.frame.name : "";
  } catch {
    // Electron throws reading a frame whose render frame is gone ("Render frame was disposed…"), as for a
    // frame that navigates again right after a cancelled navigation. A frame nobody can read is not let through.
    return false;
  }
  if (panelFrameName && name === panelFrameName && WEB_PAGE.test(url)) return true;
  return origin !== "null";
}

/** A link only this app can open (electron/main.mjs): a page inside the app cannot open one by itself, so the page the
 * person pinned hands it to main instead. */
export function isAppLink(url) {
  return typeof url === "string" && url.length <= 2048 && /^mengbot:\/\//i.test(url);
}

/**
 * Names the pinned page's frames for appFrameNavigationAllowed. A page may rename its own browsing context
 * (window.name), and the page the person pinned keeps loading after it does: a frame that carried the name once is
 * known by it for as long as the frame lives.
 * @param {string} panelFrameName the name main made for the pinned page's iframe (electron/main.mjs)
 * @returns {(details: { frame?: { name?: string, frameTreeNodeId?: number } | null } | null | undefined) => string}
 */
export function createPanelFrameLookup(panelFrameName) {
  const seen = new Set();
  return (details) => {
    if (!panelFrameName) return "";
    let frame = null;
    try {
      frame = details?.frame;
    } catch {
      return "";
    }
    if (!frame) return "";
    let id;
    let name = "";
    try {
      id = frame.frameTreeNodeId;
      name = typeof frame.name === "string" ? frame.name : "";
    } catch {
      // A frame whose render frame is gone (see above) is not one to trust.
      return "";
    }
    if (typeof id === "number" && seen.has(id)) return panelFrameName;
    if (name !== panelFrameName) return "";
    if (typeof id === "number") seen.add(id);
    return panelFrameName;
  };
}