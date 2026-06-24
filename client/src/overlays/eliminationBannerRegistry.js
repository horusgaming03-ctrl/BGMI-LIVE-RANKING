import { getTheme } from "./themes";
import { cyberpunkElimStyleFromTheme } from "./cyberpunkElimUtils";
import { neonElimStyleFromTheme } from "./neonElimUtils";
import { minimalElimStyleFromTheme } from "./minimalGfxUtils";
import { broadcastElimStyleFromTheme } from "./broadcastGfxUtils";
import { CYBERPUNK_ELIMINATION_PICKERS } from "./cyberpunkElimUtils";
import { NEON_ELIMINATION_PICKERS } from "./neonElimUtils";
import { MINIMAL_ELIMINATION_PICKERS } from "./minimalGfxUtils";
import { BROADCAST_ELIMINATION_PICKERS } from "./broadcastGfxUtils";

/** All selectable elimination banner layouts. */
export const ELIMINATION_BANNER_LAYOUTS = [
  { id: "neonPanel", label: "Neon panel", sourceTheme: "neon" },
  { id: "stacked", label: "Stacked / combat", sourceTheme: "minimal" },
  { id: "minimalBroadcast", label: "Minimal tournament card", sourceTheme: "cyberpunk" },
  { id: "broadcast", label: "Clean broadcast", sourceTheme: "cleanBroadcast" },
  { id: "classic", label: "Classic esports", sourceTheme: "esports" },
];

const VALID_LAYOUTS = new Set(ELIMINATION_BANNER_LAYOUTS.map((o) => o.id));

const LAYOUT_SOURCE = Object.fromEntries(
  ELIMINATION_BANNER_LAYOUTS.map((o) => [o.id, o.sourceTheme]),
);

export function isValidEliminationBannerLayout(id) {
  return VALID_LAYOUTS.has(id);
}

/** Default layout shipped with a static theme file. */
export function defaultBannerLayoutForTheme(baseTheme) {
  const layout = baseTheme?.elimination?.layout;
  if (layout && VALID_LAYOUTS.has(layout)) return layout;
  if (baseTheme?.broadcastLayout) return "broadcast";
  return "classic";
}

/** Guess layout from saved elimination color keys (legacy saves without bannerLayout). */
function inferBannerLayoutFromEliminationKeys(el) {
  if (!el || typeof el !== "object") return null;
  if (el.logoPanelBg && el.titleBg) return "stacked";
  if (el.leftPanelBg || el.rankBadgeText || el.elimBg) return "minimalBroadcast";
  if (el.rankPanelBg && el.borderColor) return "neonPanel";
  if (el.panelBg || el.nameTagBg) return "broadcast";
  return null;
}

/** Active layout: saved override → inferred keys → theme default → classic. */
export function resolveEliminationBannerLayout(theme) {
  const el = theme?.elimination || {};
  const override = el.bannerLayout;
  if (override && VALID_LAYOUTS.has(override)) return override;
  const inferred = inferBannerLayoutFromEliminationKeys(el);
  if (inferred && VALID_LAYOUTS.has(inferred)) return inferred;
  const layout = el.layout;
  if (layout && VALID_LAYOUTS.has(layout)) return layout;
  if (theme?.broadcastLayout) return "broadcast";
  return "classic";
}

export function isNeonElimBannerLayout(theme) {
  return resolveEliminationBannerLayout(theme) === "neonPanel";
}

export function isStackedElimBannerLayout(theme) {
  return resolveEliminationBannerLayout(theme) === "stacked";
}

export function isMinimalElimBannerLayout(theme) {
  return resolveEliminationBannerLayout(theme) === "minimalBroadcast";
}

export function isBroadcastElimBannerLayout(theme) {
  return resolveEliminationBannerLayout(theme) === "broadcast";
}

export function isClassicElimBannerLayout(theme) {
  return resolveEliminationBannerLayout(theme) === "classic";
}

/** Default elimination tokens for a layout (from its source theme). */
export function defaultEliminationForLayout(layoutId) {
  const source = LAYOUT_SOURCE[layoutId] || "esports";
  const t = getTheme(source);
  const el = t?.elimination && typeof t.elimination === "object" ? { ...t.elimination } : {};
  delete el.bannerLayout;
  return { ...el, bannerLayout: layoutId };
}

/** Merge layout defaults when user picks a new banner style (replaces prior layout color keys). */
export function mergeEliminationForBannerLayout(_prevElim, layoutId) {
  return defaultEliminationForLayout(layoutId);
}

/** Resolved hex for an elimination layout color picker. */
export function elimPickerResolvedColor(theme, layoutId, key, patch = null) {
  const mergedElim =
    patch && typeof patch === "object"
      ? { ...(theme?.elimination || {}), ...patch }
      : theme?.elimination || {};
  const draft = elimStyleDraftFromTheme({
    ...theme,
    elimination: {
      ...mergedElim,
      bannerLayout: layoutId,
      layout: layoutId,
    },
  });
  const raw = patch?.[key] ?? draft[key];
  if (typeof raw === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(raw.trim())) {
    return raw.trim();
  }
  return layoutElimDefaultForKey(layoutId, key);
}

export function eliminationPickersForLayout(layoutId) {
  switch (layoutId) {
    case "neonPanel":
      return NEON_ELIMINATION_PICKERS;
    case "stacked":
      return CYBERPUNK_ELIMINATION_PICKERS;
    case "minimalBroadcast":
      return MINIMAL_ELIMINATION_PICKERS;
    case "broadcast":
      return BROADCAST_ELIMINATION_PICKERS;
    default:
      return [];
  }
}

export function eliminationPickerKeysForLayout(layoutId) {
  return eliminationPickersForLayout(layoutId).map(([key]) => key);
}

/** Extract layout-specific color keys from a flat admin draft object. */
export function layoutElimPatchFromDraft(draft, layoutId) {
  const patch = {};
  if (!draft || typeof draft !== "object") return patch;
  for (const key of eliminationPickerKeysForLayout(layoutId)) {
    if (draft[key] != null && typeof draft[key] === "string") patch[key] = draft[key];
  }
  if (draft.animation != null && typeof draft.animation === "string") {
    patch.animation = draft.animation;
  }
  return patch;
}

/** Flat picker values for the active elimination banner layout. */
export function elimStyleDraftFromTheme(theme) {
  const layout = resolveEliminationBannerLayout(theme);
  const styles = eliminationBannerStyleFromTheme(theme);
  switch (layout) {
    case "neonPanel":
      return { ...(styles.neonStyle || {}) };
    case "stacked":
      return { ...(styles.cyberpunkStyle || {}) };
    case "minimalBroadcast":
    case "broadcast":
      return { ...(styles.broadcastStyle || {}) };
    default:
      return {};
  }
}

/** Solid hex fallback for a layout picker (gradients → #888888). */
export function layoutElimDefaultForKey(layoutId, key) {
  const defaults = defaultEliminationForLayout(layoutId);
  const raw = defaults[key];
  if (typeof raw === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(raw.trim())) {
    return raw.trim();
  }
  const source = LAYOUT_SOURCE[layoutId] || "esports";
  const t = getTheme(source);
  const draft = elimStyleDraftFromTheme({
    ...t,
    elimination: { ...defaults, bannerLayout: layoutId, layout: layoutId },
  });
  const val = draft[key];
  if (typeof val === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(val.trim())) {
    return val.trim();
  }
  return "#888888";
}

export function elimLayoutUsesDedicatedPickers(layoutId) {
  return layoutId != null && layoutId !== "classic";
}

export function eliminationBannerStyleFromTheme(theme) {
  const layout = resolveEliminationBannerLayout(theme);
  switch (layout) {
    case "neonPanel":
      return { layout, neonStyle: neonElimStyleFromTheme(theme), neonLayout: true };
    case "stacked":
      return { layout, cyberpunkStyle: cyberpunkElimStyleFromTheme(theme), cyberpunkLayout: true };
    case "minimalBroadcast":
      return {
        layout,
        broadcastStyle: minimalElimStyleFromTheme(theme),
        minimalBroadcastLayout: true,
        broadcastLayout: true,
      };
    case "broadcast":
      return {
        layout,
        broadcastStyle: broadcastElimStyleFromTheme(theme),
        broadcastLayout: true,
      };
    default:
      return { layout: "classic" };
  }
}
