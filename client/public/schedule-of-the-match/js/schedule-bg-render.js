import { scheduleBackgroundMediaType } from "./config-store.js";

export function sizeBackgroundCoverEl(el, bgConfig, designW = 1920, designH = 1080) {
  const nw = el.videoWidth || el.naturalWidth;
  const nh = el.videoHeight || el.naturalHeight;
  if (!nw || !nh) return;
  const bleed = Math.max(1, Number(bgConfig?.scale) || 1.05);
  const cover = Math.max(designW / nw, designH / nh);
  const s = cover * bleed;
  el.style.width = `${Math.ceil(nw * s)}px`;
  el.style.height = `${Math.ceil(nh * s)}px`;
}

/** Force seamless loop (OBS + admin preview; some MP4s ignore loop attribute). */
export function wireLoopingVideo(video) {
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("muted", "");
  video.setAttribute("loop", "");
  video.setAttribute("autoplay", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");

  const restart = () => {
    try {
      video.currentTime = 0;
    } catch (_) {}
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  };

  video.addEventListener("ended", restart);
  video.addEventListener("timeupdate", () => {
    const d = video.duration;
    if (!Number.isFinite(d) || d < 0.2) return;
    if (video.currentTime >= d - 0.12) restart();
  });

  const tryPlay = () => {
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  };
  video.addEventListener("loadeddata", tryPlay);
  video.addEventListener("canplay", tryPlay);

  return video;
}

function backgroundMountKey(bg, resolveAssetUrl) {
  if (!bg?.imageUrl) return "";
  const url = resolveAssetUrl(bg.imageUrl);
  return [
    url,
    bg.fit || "cover",
    bg.opacity != null ? bg.opacity : 1,
    scheduleBackgroundMediaType(bg),
    bg.position || "center center",
    bg.scale != null ? bg.scale : 1.05,
  ].join("|");
}

/** Remount only when background settings change (keeps video loop uninterrupted). */
export function mountScheduleBackgroundIfChanged(bgLayer, bg, resolveAssetUrl) {
  const key = backgroundMountKey(bg, resolveAssetUrl);
  if (key && bgLayer.dataset.bgKey === key && bgLayer.childNodes.length > 0) {
    bgLayer.style.display = "block";
    return true;
  }
  bgLayer.dataset.bgKey = key;
  return mountScheduleBackground(bgLayer, bg, resolveAssetUrl);
}

/** Mount image or looping video into #som-bg */
export function mountScheduleBackground(bgLayer, bg, resolveAssetUrl) {
  bgLayer.innerHTML = "";
  if (!bg?.imageUrl) {
    bgLayer.dataset.bgKey = "";
  }
  if (!bg?.imageUrl) {
    bgLayer.style.display = "none";
    return false;
  }
  const url = resolveAssetUrl(bg.imageUrl);
  const fit = bg.fit === "contain" ? "contain" : "cover";
  const opacity = String(bg.opacity != null ? bg.opacity : 1);
  const isVideo = scheduleBackgroundMediaType(bg) === "video";

  if (isVideo && fit === "cover") {
    const video = wireLoopingVideo(document.createElement("video"));
    video.className = "som-bg__cover som-bg__cover-video";
    video.style.opacity = opacity;
    video.onloadedmetadata = () => sizeBackgroundCoverEl(video, bg);
    video.onerror = () => console.warn("[schedule-overlay] background video failed:", url);
    video.src = url;
    bgLayer.appendChild(video);
  } else if (fit === "cover") {
    const img = document.createElement("img");
    img.className = "som-bg__cover";
    img.alt = "";
    img.decoding = "async";
    img.style.opacity = opacity;
    img.onload = () => sizeBackgroundCoverEl(img, bg);
    img.onerror = () => console.warn("[schedule-overlay] background image failed:", url);
    img.src = url;
    if (img.complete && img.naturalWidth) sizeBackgroundCoverEl(img, bg);
    bgLayer.appendChild(img);
  } else {
    const fill = document.createElement("div");
    fill.className = "som-bg__fill";
    fill.dataset.fit = "contain";
    if (isVideo) {
      const video = wireLoopingVideo(document.createElement("video"));
      video.className = "som-bg__fill-video";
      video.style.opacity = opacity;
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "contain";
      video.src = url;
      fill.appendChild(video);
    } else {
      fill.style.backgroundImage = `url(${JSON.stringify(url)})`;
      fill.style.backgroundPosition = bg.position || "center center";
      fill.style.opacity = opacity;
    }
    bgLayer.appendChild(fill);
  }
  bgLayer.style.display = "block";
  return true;
}
