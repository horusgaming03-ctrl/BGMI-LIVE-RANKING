/** Build overlay ticker state from socket payload or GET /overlay/announcement-state */
export function parseAnnouncementCommand(cmd, remainingMsOverride) {
  if (!cmd || typeof cmd !== "object" || cmd.type !== "adminAnnouncement") return null;
  const msg = String(cmd.message ?? cmd.text ?? "").trim();
  const imageUrl = String(cmd.imageUrl ?? cmd.image ?? "").trim();
  if (!msg && !imageUrl) return null;

  const rawMs = Number(cmd.durationMs);
  const durationMs =
    Number.isFinite(rawMs) && rawMs >= 2000 ? Math.min(60000, rawMs) : imageUrl ? 12000 : 9000;

  const sentAt = Number(cmd.sentAt) || Date.now();
  let remainingMs = Number(remainingMsOverride);
  if (!Number.isFinite(remainingMs)) {
    remainingMs = Math.max(0, durationMs - (Date.now() - sentAt));
  }
  if (remainingMs < 400) return null;

  return {
    message: msg,
    imageUrl: imageUrl || null,
    durationMs,
    remainingMs,
    sentAt,
    seq: sentAt,
  };
}
