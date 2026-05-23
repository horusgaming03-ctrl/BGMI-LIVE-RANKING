import { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from "react";
import { connectSocket, getApiBase, getOverlayPageOrigin } from "./apiOrigin";
import { wwcdPercentMapFromTeams } from "./wwcdModel";
import { normalizeMatchMeta } from "./normalizeMatchMeta";
import RondoKnockMatrix from "./rondo/RondoKnockMatrix";
import { getRondoRecallChargesRemaining } from "./rondo/recallCharges.js";
import { buildLiveRankingOrder } from "./teamDisplayOrder";
import { SIDE_OVERLAY_DEFAULT_PREFS, mergeSideOverlayPrefs, clampHexColor, stableCanonSidePrefs } from "./sideOverlayPrefs";

const API = getApiBase();
const socket = connectSocket();
const defaultForm = { team: "", status: "alive", finishes: 0, points: 0, displayOrder: 0 };

/** Match board map — persisted on server alongside `currentMatch` */
const BGMI_MAP_OPTS = [
  { value: "erangel", label: "ERANGEL" },
  { value: "miramar", label: "MIRAMAR" },
  { value: "rondo", label: "RONDO" },
];

function bgmiMapLabel(slug) {
  const hit = BGMI_MAP_OPTS.find((o) => o.value === String(slug || "").toLowerCase());
  return hit ? hit.label : "ERANGEL";
}

function normalizeWwcdArts(arr) {
  const src = Array.isArray(arr) ? arr : [];
  return [0, 1, 2, 3].map((i) => (typeof src[i] === "string" && src[i].trim() ? src[i].trim() : null));
}

export default function AdminPanel() {
  const [teams, setTeams] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("Select a team to edit or create a new one.");

  // ── New State ──
  const [currentMatch, setCurrentMatch] = useState({
    number: 1,
    status: "live",
    startedAt: Date.now(),
    map: "erangel",
    matchLabel: "",
  });
  const [autoCalculate, setAutoCalculate] = useState(true);
  const [matchHistory, setMatchHistory] = useState([]);
  const [tournamentStats, setTournamentStats] = useState([]);
  const [expandedSection, setExpandedSection] = useState("dashboard");
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [screenshotResults, setScreenshotResults] = useState(null);
  const [processingScreenshot, setProcessingScreenshot] = useState(false);
  const [chickenDinnerTeam, setChickenDinnerTeam] = useState(null);
  const [wwcdColors, setWwcdColors] = useState({ primary: "", gold: "", accent: "", bg: "" });
  const [wwcdCharacterArts, setWwcdCharacterArts] = useState([null, null, null, null]);
  const [wwcdSlotSelected, setWwcdSlotSelected] = useState(0);
  const [wwcdUrlDraft, setWwcdUrlDraft] = useState("");
  const sideBannerTourLogoRef = useRef(null);
  const [sideOverlayDraft, setSideOverlayDraft] = useState(() => ({ ...SIDE_OVERLAY_DEFAULT_PREFS }));
  const [broadcastTournamentLogo, setBroadcastTournamentLogo] = useState(null);

  /** After first `/settings`, side banner colors auto-save debounced — refs avoid ping-pong loops */
  const sidePrefsHydratedRef = useRef(false);
  const sideLastCanonRef = useRef("");
  const sideAutosaveTimerRef = useRef(null);

  const [screenshotPreviews, setScreenshotPreviews] = useState([]);
  const screenshotInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const wwcdFileInputRef = useRef(null);
  const overallBgSectionRef = useRef(null);
  const [pendingNewLogo, setPendingNewLogo] = useState(null); // { file: File, url: string }
  /** @type {React.MutableRefObject<number|'new'|null>} */
  const logoPickerTargetRef = useRef(null);
  /** Focus team name when + Add team scrolls to the form. */
  const teamNameInputRef = useRef(null);
  /** Last Match # acknowledged from server (for Match → 1 tournament reset confirm). */
  const lastServerMatchNumberRef = useRef(1);
  const [activeOverlayTheme, setActiveOverlayTheme] = useState("esports");
  const [overallStandingsBg, setOverallStandingsBg] = useState(null);
  const [obsSharedTriplePng, setObsSharedTriplePng] = useState(null);
  const [obsSharedTripleColumns, setObsSharedTripleColumns] = useState("live5");
  const [obsTripleFpMetric, setObsTripleFpMetric] = useState("points");
  const [overallBgUploadMsg, setOverallBgUploadMsg] = useState("");
  const [zoneCueHeadline, setZoneCueHeadline] = useState("");
  const [zoneCueSubtitle, setZoneCueSubtitle] = useState("");
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [googleIntegration, setGoogleIntegration] = useState({
    enabled: false,
    driveFolderId: "",
    registrationSpreadsheetId: "",
    registrationRange: "Form Responses 1!A:Z",
    syncIntervalMs: 120000,
    autoUpload: true,
  });
  const [googleMeta, setGoogleMeta] = useState({ credentialsConfigured: false, credentialsFile: null });

  // ── Existing Effects (untouched) ──
  useEffect(() => {
    const handle = (data) => setTeams(Array.isArray(data) ? data : []);
    socket.on("teamsUpdated", handle);
    socket.emit("requestTeams");
    return () => socket.off("teamsUpdated", handle);
  }, []);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedId) || null,
    [teams, selectedId]
  );

  /**
   * Load form when the *selected row* changes only — not on every `teamsUpdated`.
   * Otherwise socket refreshes wipe unsaved "Screen order" (and other edits) before Update.
   */
  useEffect(() => {
    if (selectedId == null) return;
    const t = teams.find((x) => x.id === selectedId);
    if (!t) return;
    setForm({
      team: t.team,
      status: t.status,
      finishes: t.finishes,
      points: t.points,
      displayOrder: t.displayOrder != null && Number(t.displayOrder) > 0 ? Number(t.displayOrder) : 0,
    });
  }, [selectedId]);

  // ── New Effects ──
  useEffect(() => {
    const onMatch = (data) => {
      const meta = normalizeMatchMeta(data);
      if (!meta) return;
      setCurrentMatch(meta);
      lastServerMatchNumberRef.current = meta.number;
    };
    const onSettings = (data) => {
      setAutoCalculate(Boolean(data.autoCalculate));
      if (typeof data?.activeTheme === "string" && data.activeTheme.trim()) {
        setActiveOverlayTheme(data.activeTheme);
      }
      if (data && Object.prototype.hasOwnProperty.call(data, "overallStandingsBg")) {
        setOverallStandingsBg(data.overallStandingsBg || null);
      }
      if (data && Object.prototype.hasOwnProperty.call(data, "obsSharedTriplePng")) {
        setObsSharedTriplePng(data.obsSharedTriplePng || null);
      }
      if (data && Object.prototype.hasOwnProperty.call(data, "obsSharedTripleColumns")) {
        setObsSharedTripleColumns(String(data.obsSharedTripleColumns) === "gold4" ? "gold4" : "live5");
      }
      if (data && Object.prototype.hasOwnProperty.call(data, "obsTripleFpMetric")) {
        setObsTripleFpMetric(String(data.obsTripleFpMetric) === "finishes" ? "finishes" : "points");
      }
      if (Array.isArray(data?.wwcdCharacterArts)) {
        setWwcdCharacterArts(normalizeWwcdArts(data.wwcdCharacterArts));
      }
      if (Object.prototype.hasOwnProperty.call(data, "tournamentLogo")) {
        setBroadcastTournamentLogo(data.tournamentLogo || null);
      }
      if (
        data?.sideOverlayPrefs != null &&
        typeof data.sideOverlayPrefs === "object" &&
        !Array.isArray(data.sideOverlayPrefs)
      ) {
        const merged = mergeSideOverlayPrefs(data.sideOverlayPrefs);
        setSideOverlayDraft(merged);
        sideLastCanonRef.current = stableCanonSidePrefs(merged);
        sidePrefsHydratedRef.current = true;
      } else if (!sidePrefsHydratedRef.current) {
        const merged = mergeSideOverlayPrefs({});
        setSideOverlayDraft(merged);
        sideLastCanonRef.current = stableCanonSidePrefs(merged);
        sidePrefsHydratedRef.current = true;
      }
      if (data?.googleIntegration && typeof data.googleIntegration === "object") {
        setGoogleIntegration((prev) => ({ ...prev, ...data.googleIntegration }));
      }
    };
    const onChicken = (data) => {
      setChickenDinnerTeam(data);
      setTimeout(() => setChickenDinnerTeam(null), 8000);
    };
    const onHistory = (data) => setMatchHistory(Array.isArray(data) ? data : []);
    const onTournament = (data) => setTournamentStats(Array.isArray(data) ? data : []);

    socket.on("matchUpdated", onMatch);
    socket.on("settingsUpdated", onSettings);
    socket.on("chickenDinner", onChicken);
    socket.on("historyUpdated", onHistory);
    socket.on("tournamentUpdated", onTournament);

    socket.emit("requestMatch");
    socket.emit("requestHistory");
    socket.emit("requestTournament");
    socket.emit("requestSettings");

    return () => {
      socket.off("matchUpdated", onMatch);
      socket.off("settingsUpdated", onSettings);
      socket.off("chickenDinner", onChicken);
      socket.off("historyUpdated", onHistory);
      socket.off("tournamentUpdated", onTournament);
    };
  }, []);

  /** Debounced POST so color pickers reliably sync the overlay without an extra Save click */
  useEffect(() => {
    if (!sidePrefsHydratedRef.current) return;
    const canon = stableCanonSidePrefs(sideOverlayDraft);
    if (canon === sideLastCanonRef.current) return;

    if (sideAutosaveTimerRef.current != null) window.clearTimeout(sideAutosaveTimerRef.current);
    sideAutosaveTimerRef.current = window.setTimeout(async () => {
      sideAutosaveTimerRef.current = null;
      try {
        const res = await fetch(`${API}/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sideOverlayPrefs: mergeSideOverlayPrefs(sideOverlayDraft) }),
        });
        if (res.ok) {
          const s = await res.json().catch(() => ({}));
          if (s.sideOverlayPrefs && typeof s.sideOverlayPrefs === "object") {
            const merged = mergeSideOverlayPrefs(s.sideOverlayPrefs);
            sideLastCanonRef.current = stableCanonSidePrefs(merged);
            setSideOverlayDraft(merged);
          } else {
            sideLastCanonRef.current = canon;
          }
        }
      } catch {
        /* offline / API — retry with Save side banner settings */
      }
    }, 500);

    return () => {
      if (sideAutosaveTimerRef.current != null) {
        window.clearTimeout(sideAutosaveTimerRef.current);
        sideAutosaveTimerRef.current = null;
      }
    };
  }, [sideOverlayDraft]);

  useEffect(() => {
    const onActiveTheme = (name) => {
      if (typeof name === "string" && name.trim()) setActiveOverlayTheme(name);
    };
    socket.on("activeThemeChanged", onActiveTheme);
    return () => socket.off("activeThemeChanged", onActiveTheme);
  }, []);

  useEffect(() => {
    const a = wwcdCharacterArts[wwcdSlotSelected];
    setWwcdUrlDraft(a && /^https?:\/\//i.test(a) ? a : "");
  }, [wwcdSlotSelected, wwcdCharacterArts]);

  useEffect(() => {
    if (expandedSection !== "googleSync") return;
    fetch(`${API}/integrations/google/status`)
      .then((r) => r.json())
      .then((d) => {
        setGoogleMeta({
          credentialsConfigured: Boolean(d.credentialsConfigured),
          credentialsFile: d.credentialsFile || null,
        });
        if (d.integration && typeof d.integration === "object") {
          setGoogleIntegration((prev) => ({ ...prev, ...d.integration }));
        }
      })
      .catch(() => {});
  }, [expandedSection]);

  const clearPendingNewLogo = useCallback(() => {
    setPendingNewLogo((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  // ── Existing Handlers (untouched) ──
  const selectTeam = (team) => {
    clearPendingNewLogo();
    setSelectedId(team.id);
    setMessage(`Editing ${team.team}`);
    setForm({
      team: team.team,
      status: team.status,
      finishes: team.finishes,
      points: team.points,
      displayOrder: team.displayOrder != null && Number(team.displayOrder) > 0 ? Number(team.displayOrder) : 0,
    });
  };

  const createTeam = async () => {
    const res = await fetch(`${API}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team: form.team,
        status: form.status,
        finishes: Number(form.finishes),
        points: Number(form.points),
        displayOrder: Number(form.displayOrder) || 0,
      }),
    });

    if (!res.ok) {
      setMessage("Could not add team.");
      return;
    }

    let created = null;
    try {
      created = await res.json();
    } catch (_) {
      created = null;
    }

    let msg = "New team added.";
    const file = pendingNewLogo?.file;
    if (file && created && created.id != null) {
      const ok = await uploadLogo(created.id, file, { quiet: true });
      if (ok) {
        msg += " Logo uploaded.";
        clearPendingNewLogo();
      } else {
        msg += " Team added, but logo upload failed — try Choose logo again or upload from the table.";
      }
    }

    setMessage(msg);
    setForm(defaultForm);
  };

  const updateTeam = async () => {
    if (!selectedId) return setMessage("Select a team first.");

    const res = await fetch(`${API}/teams/${selectedId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team: form.team,
        status: form.status,
        finishes: Number(form.finishes),
        points: Number(form.points),
        displayOrder: Number(form.displayOrder) || 0,
      }),
    });

    setMessage(res.ok ? "Team updated live." : "Update failed.");
  };

  /** Enter in any live team field: update if something is selected, otherwise add team. */
  const submitLiveTeamForm = () => {
    if (selectedId) void updateTeam();
    else void createTeam();
  };

  const deleteTeam = async (id) => {
    const res = await fetch(`${API}/teams/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      if (selectedId === id) {
        setSelectedId(null);
        setForm(defaultForm);
        clearPendingNewLogo();
      }
      setMessage("Team deleted.");
    } else {
      setMessage("Delete failed.");
    }
  };

  // ── New Handlers ──
  const knockTeam = useCallback(async (teamId, knockCount, fullElimination = false) => {
    const wiping = knockCount >= 4 || fullElimination === true;
    const mapSlug = normalizeMatchMeta(currentMatch)?.map || "erangel";

    if (wiping && mapSlug === "rondo") {
      try {
        const chk = await fetch(`${API}/match/current`);
        if (chk.ok) {
          const mc = await chk.json();
          const serverSlug = normalizeMatchMeta(mc)?.map || "erangel";
          if (serverSlug !== "rondo") {
            setMessage(
              `KO failed: admin shows Rondo but API reports map="${serverSlug}". Save Match → Rondo, restart Node, Sync match, retry OUT.`,
            );
            socket.emit("requestMatch");
            socket.emit("requestTeams");
            return;
          }
        }
      } catch {
        /* continue */
      }
    }

    const rosterTeam = teams.find((t) => t.id === teamId);

    const res = await fetch(`${API}/teams/${teamId}/knock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knockCount, fullElimination }),
    });
    if (!res.ok) {
      let msg = "Knock update failed.";
      try {
        const j = await res.json();
        if (j?.message) msg = String(j.message);
      } catch {
        /* ignore */
      }
      setMessage(msg);
      return;
    }

    try {
      const updated = await res.json();
      if (
        wiping &&
        mapSlug === "rondo" &&
        rosterTeam &&
        getRondoRecallChargesRemaining(rosterTeam) > 0 &&
        !["rondo_benched", "eliminated"].includes(String(rosterTeam.status || "").toLowerCase())
      ) {
        const nextSt = String(updated?.status || "").toLowerCase();
        if (nextSt !== "rondo_benched") {
          setMessage(
            `Rondo mismatch: OUT should bench first wipe, API returned="${updated?.status}". Another backend build may still be serving, or stale state.`,
          );
          socket.emit("requestTeams");
          socket.emit("requestMatch");
          return;
        }
        setMessage("Rondo recall bench — squad is benched. Deploy recall from the recall row.");
        return;
      }
    } catch {
      /* ignore */
    }

    setMessage("Knock updated live.");
  }, [API, teams, currentMatch]);

  const setAlive = useCallback(async (teamId, alivePlayers) => {
    const zeroWipe = Number(alivePlayers) === 0;
    const mapSlug = normalizeMatchMeta(currentMatch)?.map || "erangel";

    if (zeroWipe && mapSlug === "rondo") {
      try {
        const chk = await fetch(`${API}/match/current`);
        if (chk.ok) {
          const mc = await chk.json();
          const serverSlug = normalizeMatchMeta(mc)?.map || "erangel";
          if (serverSlug !== "rondo") {
            setMessage(
              `0-alive KO failed: admin shows Rondo but API map="${serverSlug}". Sync Match board + restart backend.`,
            );
            socket.emit("requestMatch");
            return;
          }
        }
      } catch {
        /* continue */
      }
    }

    const rosterTeam = teams.find((t) => t.id === teamId);

    const res = await fetch(`${API}/teams/${teamId}/alive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alivePlayers }),
    });
    if (!res.ok) {
      let msg = "Alive count failed.";
      try {
        const j = await res.json();
        if (j?.message) msg = String(j.message);
      } catch {
        /* ignore */
      }
      setMessage(msg);
      return;
    }

    try {
      const updated = await res.json();
      if (
        zeroWipe &&
        mapSlug === "rondo" &&
        rosterTeam &&
        getRondoRecallChargesRemaining(rosterTeam) > 0 &&
        !["rondo_benched", "eliminated"].includes(String(rosterTeam.status || "").toLowerCase())
      ) {
        const nextSt = String(updated?.status || "").toLowerCase();
        if (nextSt !== "rondo_benched") {
          setMessage(`Rondo mismatch: setting 0-alive should bench; API="${updated?.status}".`);
          socket.emit("requestTeams");
          socket.emit("requestMatch");
          return;
        }
        setMessage("Rondo recall bench — squad benched.");
        return;
      }
    } catch {
      /* ignore */
    }

    setMessage("Alive count updated.");
  }, [API, teams, currentMatch]);

  const triggerRondoRecall = useCallback(
    async (teamId, addAliveSlots) => {
      const mapSlug = normalizeMatchMeta(currentMatch)?.map || "erangel";
      if (mapSlug === "rondo") {
        try {
          const chk = await fetch(`${API}/match/current`);
          if (chk.ok) {
            const mc = await chk.json();
            const serverSlug = normalizeMatchMeta(mc)?.map || "erangel";
            if (serverSlug !== "rondo") {
              setMessage(
                `Recall failed: admin shows Rondo but API map="${serverSlug}". Open Match board, set map to Rondo, save — then retry.`,
              );
              socket.emit("requestMatch");
              return;
            }
          }
        } catch {
          /* continue */
        }
      }

      const hasSlots = typeof addAliveSlots === "number" && Number.isFinite(addAliveSlots);
      const body = hasSlots ? { addAliveSlots: Math.trunc(addAliveSlots) } : undefined;

      const res = await fetch(`${API}/teams/${teamId}/rondo-recall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        let msg = "Recall failed.";
        try {
          const j = await res.json();
          if (j?.message) msg = String(j.message);
        } catch {
          /* ignore */
        }
        setMessage(msg);
        socket.emit("requestTeams");
        socket.emit("requestMatch");
        return;
      }
      try {
        const t = await res.json();
        const ap = Math.max(0, Math.min(4, Number(t?.alivePlayers ?? 4)));
        const rem = typeof t?.rondoRecallChargesRemaining === "number" ? t.rondoRecallChargesRemaining : getRondoRecallChargesRemaining(t);
        setMessage(`Rondo redeploy OK — squad ${ap}/4, ${rem} credit${rem === 1 ? "" : "s"} left.`);
      } catch {
        setMessage("Rondo redeploy OK — standings refreshed.");
      }
      socket.emit("requestTeams");
      socket.emit("requestMatch");
    },
    [API, currentMatch],
  );

  const undoRondoMistakenBench = useCallback(
    async (teamId) => {
      const mapSlug = normalizeMatchMeta(currentMatch)?.map || "erangel";
      if (mapSlug === "rondo") {
        try {
          const chk = await fetch(`${API}/match/current`);
          if (chk.ok) {
            const mc = await chk.json();
            const serverSlug = normalizeMatchMeta(mc)?.map || "erangel";
            if (serverSlug !== "rondo") {
              setMessage(
                `Undo failed: admin shows Rondo but API map="${serverSlug}". Save Match → Rondo on the server, then retry.`,
              );
              socket.emit("requestMatch");
              return;
            }
          }
        } catch {
          /* continue */
        }
      }

      const res = await fetch(`${API}/teams/${teamId}/rondo-undo-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        let msg = "Could not undo bench OUT.";
        try {
          const j = await res.json();
          if (j?.message) msg = String(j.message);
        } catch {
          /* ignore */
        }
        setMessage(msg);
        socket.emit("requestTeams");
        socket.emit("requestMatch");
        return;
      }
      setMessage("Mistaken OUT undone — squad restored to 4/4 combat (still on recall bench credits as before).");
      socket.emit("requestTeams");
      socket.emit("requestMatch");
    },
    [API, currentMatch],
  );

  const finalizeBenchedElimination = useCallback(async (team) => {
    const res = await fetch(`${API}/teams/${team.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team: team.team,
        status: "eliminated",
        finishes: Number(team.finishes ?? 0),
        points: Number(team.points ?? 0),
      }),
    });
    if (!res.ok) {
      let msg = "Could not finalize elimination.";
      try {
        const j = await res.json();
        if (j?.message) msg = String(j.message);
      } catch {
        /* ignore */
      }
      setMessage(msg);
      return;
    }
    setMessage("Benched squad marked final elimination (no recall).");
  }, []);

  /** Finish points (same field as kills / OCR “finishes”) — syncs to live rankings via Socket.io. */
  const adjustTeamFinishes = useCallback(
    async (team, delta) => {
      const nextFinishes = Math.max(0, Number(team.finishes || 0) + delta);
      const pos = Number(team.positionPoints) || 0;
      const payload = {
        team: team.team,
        status: team.status,
        finishes: nextFinishes,
        points: autoCalculate ? nextFinishes + pos : Math.max(0, Number(team.points || 0) + delta),
      };
      const res = await fetch(`${API}/teams/${team.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) setMessage("Finish points updated — rankings refreshed.");
      else setMessage("Could not update finishes.");
    },
    [autoCalculate]
  );

  const startNewMatch = async () => {
    if (!window.confirm("Start a new match? Current match data will be saved to history.")) return;
    const res = await fetch(`${API}/match/new`, { method: "POST" });
    if (res.ok) {
      setMessage("New match started — Match # increased for the next round.");
      fetchHistory();
    }
  };

  /** Full restart: Match #1 + cleared history + reset scores (top bar & Quick controls). */
  const restartSeriesAtMatchOne = async () => {
    if (
      !window.confirm(
        "Everything will start again from Match #1.\n\n• Match History will be cleared\n• Overall standings / series totals reset (live lobby scores zeroed)\n• Every team's finishes, placement points, WWCD count in this lobby reset\n\nYour map selection is kept. Continue?"
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${API}/match/series-restart`, { method: "POST" });
      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      if (!res.ok) {
        setMessage("Could not restart tournament — check API is running (node index.js).");
        return;
      }
      if (!payload || typeof payload !== "object" || payload.match == null || typeof payload.match !== "object") {
        setMessage("Tournament restart failed — unexpected API response. Restart the backend and hard-refresh admin.");
        socket.emit("requestMatch");
        socket.emit("requestHistory");
        return;
      }
      const meta = normalizeMatchMeta(payload.match);
      if (!meta || meta.number !== 1) {
        setMessage("Tournament restart did not sync — reload the admin page.");
        socket.emit("requestMatch");
        return;
      }
      setCurrentMatch(meta);
      lastServerMatchNumberRef.current = 1;
      socket.emit("requestMatch");
      socket.emit("requestHistory");
      socket.emit("requestTournament");
      socket.emit("requestTeams");
      fetchHistory();
      setMessage("Restart complete — Match #1. Match History cleared; standings reset.");
    } catch {
      setMessage("Could not restart tournament — connection error.");
    }
  };

  const endMatch = async () => {
    await fetch(`${API}/match/end`, { method: "POST" });
    setMessage("Match ended.");
  };

  const saveGoogleConfig = useCallback(async () => {
    const res = await fetch(`${API}/integrations/google/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(googleIntegration),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.googleIntegration) {
      setGoogleIntegration(j.googleIntegration);
      setMessage("Google integration settings saved.");
    } else setMessage(j.message || "Could not save Google settings.");
  }, [googleIntegration]);

  const runGoogleSyncNow = useCallback(async () => {
    const res = await fetch(`${API}/integrations/google/sync`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(
        `Google sync OK — sheet rows: ${j.sheets?.rows ?? "?"}, Drive images imported: ${j.drive?.imported ?? 0}`
      );
      socket.emit("requestTeams");
      socket.emit("requestTournament");
    } else setMessage(j.message || "Google sync failed.");
  }, []);

  const runGoogleExportNow = useCallback(async () => {
    const res = await fetch(`${API}/integrations/google/export`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setMessage("Tournament snapshot uploaded to Google Drive.");
    else setMessage(j.message || "Drive export failed.");
  }, []);

  const patchMatchMeta = useCallback(async (patch) => {
    try {
      const res = await fetch(`${API}/match/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      if (!res.ok) {
        setMessage("Could not save match header — check API is running.");
        return { ok: false, payload };
      }
      if (!payload || typeof payload !== "object" || payload.match == null || typeof payload.match !== "object") {
        setMessage(
          "Match header save failed — API response missing match data (wrong URL or API not restarted). Use `npm run dev` with `/api` proxy or set VITE_API_URL to your Node origin.",
        );
        socket.emit("requestMatch");
        return { ok: false, payload };
      }
      const meta = normalizeMatchMeta(payload?.match);
      if (patch != null && Object.prototype.hasOwnProperty.call(patch, "number")) {
        const wanted = Math.max(1, Math.min(99999, Math.floor(Number(patch.number)) || 1));
        if (!meta || meta.number !== wanted) {
          const gotStr = meta ? String(meta.number) : "(missing)";
          setMessage(
            `Match # did not sync — expected ${wanted}, server returned ${gotStr}. Reload the admin page or confirm the Node API on port 3001 is running.`,
          );
          socket.emit("requestMatch");
          return { ok: false, payload };
        }
      }
      if (meta) {
        setCurrentMatch(meta);
        lastServerMatchNumberRef.current = meta.number;
      } else if (patch != null && Object.prototype.hasOwnProperty.call(patch, "number")) {
        const nn = Math.max(1, Math.min(99999, Math.floor(Number(patch.number)) || 1));
        setCurrentMatch((p) => ({ ...p, number: nn }));
        lastServerMatchNumberRef.current = nn;
      }
      socket.emit("requestMatch");
      if (payload?.tournamentReset) {
        socket.emit("requestHistory");
        socket.emit("requestTournament");
        socket.emit("requestTeams");
      }
      return { ok: true, payload };
    } catch {
      setMessage("Could not save match header — connection error.");
      return { ok: false, payload: null };
    }
  }, []);

  /** Persist Match # with confirm when jumping to #1 from #2+ (server clears history & resets scores). */
  const submitMatchNumberFromInput = useCallback(
    async (rawValue) => {
      const n = Math.max(1, Math.min(99999, Math.floor(Number(rawValue)) || 1));
      const prev = lastServerMatchNumberRef.current;
      if (n === 1 && prev !== 1) {
        const confirmed = window.confirm(
          "Set Match # to 1? This clears ALL saved match history and resets every team's points, kills, placement WWCD, and alive status — a full new tournament. Other match numbers (#2, #3, ...) only rename the counter."
        );
        if (!confirmed) {
          setCurrentMatch((p) => ({ ...p, number: prev }));
          return;
        }
      }
      const { ok, payload } = await patchMatchMeta({ number: n });
      if (!ok) {
        setCurrentMatch((p) => ({ ...p, number: prev }));
        return;
      }
      if (payload?.tournamentReset) {
        setMessage("Match #1 — tournament reset. History cleared; all squad scores reset.");
      }
    },
    [patchMatchMeta],
  );

  const toggleAutoCalc = async () => {
    await fetch(`${API}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoCalculate: !autoCalculate }),
    });
  };

  const fetchHistory = async () => {
    const res = await fetch(`${API}/matches/history`);
    if (res.ok) setMatchHistory(await res.json());
  };

  const deleteMatch = async (matchId) => {
    if (!window.confirm("Delete this match from history?")) return;
    await fetch(`${API}/matches/${matchId}`, { method: "DELETE" });
    fetchHistory();
  };

  const restoreMatch = async (matchId) => {
    if (!window.confirm("Restore this match? Current data will be replaced.")) return;
    await fetch(`${API}/matches/${matchId}/restore`, { method: "POST" });
    setMessage("Match restored.");
  };

  const uploadLogo = async (teamId, file, opts = {}) => {
    const { quiet } = opts;
    const fd = new FormData();
    fd.append("logo", file);
    const res = await fetch(`${API}/teams/${teamId}/logo`, { method: "POST", body: fd });
    if (!quiet) setMessage(res.ok ? "Logo uploaded!" : "Logo upload failed.");
    return res.ok;
  };

  const triggerLogoPick = (target) => {
    logoPickerTargetRef.current = target;
    logoInputRef.current?.click();
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    const target = logoPickerTargetRef.current;
    logoPickerTargetRef.current = null;
    e.target.value = "";
    if (!file || target == null) return;

    if (target === "new") {
      setPendingNewLogo((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { file, url: URL.createObjectURL(file) };
      });
      setMessage("Logo will attach when you click Add Team.");
      return;
    }

    uploadLogo(target, file);
  };

  const handleScreenshotUpload = async (files) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;
    setProcessingScreenshot(true);
    screenshotPreviews.forEach((u) => URL.revokeObjectURL(u));
    setScreenshotPreviews(fileList.map((f) => URL.createObjectURL(f)));
    const fd = new FormData();
    fileList.forEach((f) => fd.append("screenshots", f));
    try {
      const res = await fetch(`${API}/upload/screenshots`, { method: "POST", body: fd });
      const data = await res.json();
      setScreenshotResults(data.ocrResults || []);
      setMessage(data.message || "Screenshots processed.");
    } catch {
      setMessage("Screenshot upload failed.");
      setScreenshotResults([]);
    }
    setProcessingScreenshot(false);
  };

  const applyScreenshotData = async () => {
    if (!screenshotResults?.length) return;
    await fetch(`${API}/apply-screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: screenshotResults }),
    });
    setMessage("Screenshot data applied!");
    setScreenshotResults(null);
    screenshotPreviews.forEach((u) => URL.revokeObjectURL(u));
    setScreenshotPreviews([]);
  };

  const updateScreenshotRow = (idx, field, value) => {
    setScreenshotResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: field === "team" ? value : Number(value) };
      return next;
    });
  };

  const fetchTournament = async () => {
    const res = await fetch(`${API}/tournament/overall`);
    if (res.ok) setTournamentStats(await res.json());
  };

  const openOverlay = (mode = "") => {
    const url = mode ? `/overlay/${mode}` : "/overlay";
    window.open(url, "_blank", "width=1920,height=1080");
  };

  const openThemedOverlay = (mode = "") => {
    const base = mode ? `/overlay/themed/${mode}` : "/overlay/themed";
    window.open(`${base}?theme=${activeOverlayTheme}`, "_blank", "width=1920,height=1080");
  };

  const sendOverlayCommand = async (command) => {
    await fetch(`${API}/overlay/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
  };

  const broadcastZoneCueToOverlay = useCallback(async () => {
    await sendOverlayCommand({
      type: "adminZoneCue",
      headline: zoneCueHeadline.trim() || "NEXT ZONE",
      subtitle: zoneCueSubtitle.trim(),
    });
    setMessage("Zone cue sent — use OBS source: /overlay/zone-prediction");
  }, [zoneCueHeadline, zoneCueSubtitle]);

  const clearZoneCueOverlay = useCallback(async () => {
    await sendOverlayCommand({ type: "adminZoneCue", clear: true });
    setMessage("Zone cue cleared (/overlay/zone-prediction).");
  }, []);

  const broadcastAnnouncementToOverlay = useCallback(async () => {
    const text = announcementDraft.trim();
    if (!text) {
      setMessage("Type announcement text first.");
      return;
    }
    await sendOverlayCommand({ type: "adminAnnouncement", message: text, durationMs: 9000 });
    setMessage("Announcement sent — use OBS source: /overlay/announcements");
  }, [announcementDraft]);

  useEffect(() => {
    fetchHistory();
    fetchTournament();
  }, []);

  const [socketConnected, setSocketConnected] = useState(Boolean(socket.connected));
  useEffect(() => {
    const up = () => setSocketConnected(true);
    const down = () => setSocketConnected(false);
    socket.on("connect", up);
    socket.on("disconnect", down);
    setSocketConnected(socket.connected);
    return () => {
      socket.off("connect", up);
      socket.off("disconnect", down);
    };
  }, []);

  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClockTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const sortedTeams = useMemo(() => buildLiveRankingOrder(teams), [teams]);

  /** Knock control only: stable row order so finish/point tweaks don't reshuffle rows. Live ranking & overlays keep server sort. */
  const knockStableOrderTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      const ida = Number(a.id);
      const idb = Number(b.id);
      if (!Number.isNaN(ida) && !Number.isNaN(idb) && ida !== idb) return ida - idb;
      if (!Number.isNaN(ida) && !Number.isNaN(idb)) return String(a.team || "").localeCompare(String(b.team || ""));
      return String(a.team || "").localeCompare(String(b.team || ""));
    });
  }, [teams]);

  /** Team Knock Control (standard map only): display numbers in row order — local UI state, never sent to the server. */
  const [knockTeamRowNumbers, setKnockTeamRowNumbers] = useState({});
  const getKnockControlDisplayNumber = useCallback((teamId, idx) => {
    const v = knockTeamRowNumbers[teamId];
    return typeof v === "number" && Number.isFinite(v) ? v : idx + 1;
  }, [knockTeamRowNumbers]);

  const commitKnockRowNumberFromIndex = useCallback(
    (idx, raw) => {
      const t = typeof raw === "string" ? raw.trim() : String(raw ?? "");
      if (t === "" || t === "-" || t === "+") return;
      const vNum = Number.parseInt(t, 10);
      if (!Number.isFinite(vNum)) return;
      setKnockTeamRowNumbers((prev) => {
        const ids = knockStableOrderTeams.map((x) => x.id);
        if (idx < 0 || idx >= ids.length) return prev;
        const disp = (i) => {
          const id = ids[i];
          if (id == null) return i + 1;
          const stored = prev[id];
          return typeof stored === "number" && Number.isFinite(stored) ? stored : i + 1;
        };
        let cleaned = Math.trunc(Math.max(1, Math.min(99999, vNum)));
        const minN = idx > 0 ? disp(idx - 1) + 1 : 1;
        cleaned = Math.max(minN, cleaned);
        const next = { ...prev };
        next[ids[idx]] = cleaned;
        for (let j = idx + 1; j < ids.length; j += 1) {
          next[ids[j]] = cleaned + (j - idx);
        }
        return next;
      });
    },
    [knockStableOrderTeams],
  );

  const matchBoardMeta = useMemo(() => normalizeMatchMeta(currentMatch), [currentMatch]);
  const rondoKnockMode = matchBoardMeta?.map === "rondo";

  const wwcdPercentById = useMemo(() => wwcdPercentMapFromTeams(teams), [teams]);

  const aliveNonEliminatedCount = useMemo(() => teams.filter((t) => ["alive", "knocked"].includes(String(t.status || "").toLowerCase())).length, [teams]);
  const topRankedTeam = sortedTeams[0] || null;

  const elapsedLabel = useMemo(() => {
    const start = typeof currentMatch.startedAt === "number" ? currentMatch.startedAt : Date.now();
    const secs = Math.max(0, Math.floor((Date.now() - start) / 1000));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [currentMatch.startedAt, clockTick]);

  const startTimeLabel = useMemo(() => {
    const start = typeof currentMatch.startedAt === "number" ? currentMatch.startedAt : Date.now();
    try {
      return new Date(start).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "—";
    }
  }, [currentMatch.startedAt]);

  const stats = {
    total: teams.length,
    alive: teams.filter((t) => t.status === "alive").length,
    knocked: teams.filter((t) => t.status === "knocked").length,
    eliminated: teams.filter((t) => t.status === "eliminated").length,
    rondoBenched: teams.filter((t) => t.status === "rondo_benched").length,
  };

  const goSection = useCallback((s) => setExpandedSection(s), []);

  const teamFormAnchorRef = useRef(null);

  const submitLiveTeamFormRef = useRef(submitLiveTeamForm);
  submitLiveTeamFormRef.current = submitLiveTeamForm;

  useLayoutEffect(() => {
    if (expandedSection !== "dashboard") return undefined;
    const form = teamFormAnchorRef.current;
    if (!form) return undefined;

    const onEnterCapture = (e) => {
      if (e.key !== "Enter" || e.repeat) return;
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      if (tag === "textarea") return;
      if (tag === "input" && String(el.type || "").toLowerCase() === "file") return;
      if (tag === "button") {
        const inStatus =
          typeof el.closest === "function" && el.closest('[role="group"][aria-label="Team status"]');
        if (!inStatus) return;
      } else if (tag !== "input") return;
      e.preventDefault();
      submitLiveTeamFormRef.current();
    };

    form.addEventListener("keydown", onEnterCapture, true);
    return () => form.removeEventListener("keydown", onEnterCapture, true);
  }, [expandedSection]);

  /** + Add team (footer): if not editing, submits immediately when name is filled; otherwise clears edit and resets form. */
  function handleFooterAddTeam() {
    teamFormAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (selectedId != null) {
      setSelectedId(null);
      clearPendingNewLogo();
      setForm(defaultForm);
      setMessage("New team — type a name, then click + Add team again (or Add Team).");
      window.setTimeout(() => teamNameInputRef.current?.focus(), 400);
      return;
    }
    const name = String(form.team || "").trim();
    if (!name) {
      setMessage("Enter a team name in Live Control, then click + Add team to add in one step.");
      window.setTimeout(() => teamNameInputRef.current?.focus(), 400);
      return;
    }
    void createTeam();
  }

  const overlayBrowserUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/overlay/themed?theme=${encodeURIComponent(activeOverlayTheme)}`
      : "";
  const zonePredictionObsUrl =
    typeof window !== "undefined" ? `${window.location.origin}/overlay/zone-prediction` : "/overlay/zone-prediction";
  const liveAnnouncementsObsUrl =
    typeof window !== "undefined" ? `${window.location.origin}/overlay/announcements` : "/overlay/announcements";
  const finishBadgesObsUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${rondoKnockMode ? "/overlay/rondo/finish-badges" : "/overlay/finish-badges"}`
      : rondoKnockMode
        ? "/overlay/rondo/finish-badges"
        : "/overlay/finish-badges";
  const overlayMatchOnlyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/overlay/themed?theme=${encodeURIComponent(activeOverlayTheme)}&live=1`
      : "";

  const refreshRankings = useCallback(async () => {
    socket.emit("requestTeams");
    try {
      const res = await fetch(`${API}/teams`);
      if (!res.ok) {
        setMessage("Could not refresh rankings — server returned an error.");
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) setTeams(data);
      setMessage("Updated rankings from server.");
    } catch {
      setMessage("Could not refresh rankings — is the API running (port 3001)?");
    }
  }, []);

  const copyOverlayUrl = useCallback(async () => {
    if (!overlayBrowserUrl) return;
    try {
      await navigator.clipboard.writeText(overlayBrowserUrl);
      setMessage("Themed overlay URL copied (FIN + TOTAL = full series by default — use Match-only Copy for lobby-only).");
    } catch {
      setMessage("Copy failed — select the URL and copy manually.");
    }
  }, [overlayBrowserUrl]);

  const copyMatchOnlyUrl = useCallback(async () => {
    if (!overlayMatchOnlyUrl) return;
    try {
      await navigator.clipboard.writeText(overlayMatchOnlyUrl);
      setMessage('Copied match-only URL (?live=1 — this lobby only).');
    } catch {
      setMessage("Copy failed — select the URL and copy manually.");
    }
  }, [overlayMatchOnlyUrl]);

  const liveSignalsPanel = (
    <>
      <div style={dash.sideCard}>
        <div style={dash.sideCardTitle}>Live signal</div>
        <div style={dash.feedListTall}>
          {sortedTeams.slice(0, 6).map((t, idx) => (
            <div key={`${t.id}-${idx}`} style={dash.feedRow}>
              <div
                style={{
                  ...styles.teamLogo,
                  width: 30,
                  height: 30,
                  fontSize: 10,
                  borderRadius: 8,
                  ...(t.logo ? { backgroundImage: `url(${API}${t.logo})`, backgroundSize: "cover", color: "transparent" } : {}),
                }}
              >
                {!t.logo && t.team.slice(0, 2)}
              </div>
              <span>
                Snapshot · <strong style={{ color: "#fff" }}>{t.team}</strong> #{idx + 1} standings ·{" "}
                {t.finishes} finishes
              </span>
            </div>
          ))}
          {sortedTeams.length === 0 ? <span style={{ color: "#6b7280", fontWeight: 600 }}>Standing by for live events…</span> : null}
        </div>
      </div>

      <div style={dash.sideCard}>
        <div style={dash.sideCardTitle}>Top squad preview</div>
        <div style={dash.previewCard}>
          {topRankedTeam ? (
            <>
              <div
                style={{
                  ...styles.teamLogo,
                  width: 52,
                  height: 52,
                  ...(topRankedTeam.logo
                    ? {
                        backgroundImage: `url(${API}${topRankedTeam.logo})`,
                        backgroundSize: "cover",
                        color: "transparent",
                      }
                    : {}),
                }}
              >
                {!topRankedTeam.logo && topRankedTeam.team.slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: "#fff" }}>{topRankedTeam.team}</div>
                <div style={{ fontSize: 12, color: "#cbd5f5", marginTop: 4 }}>
                  {(wwcdPercentById.get(topRankedTeam.id) ?? 0)}% ·{" "}
                  {aliveNonEliminatedCount >= 1 && aliveNonEliminatedCount <= 4
                    ? "Same math as overlay /overlay/wwcd-only"
                    : `WWCD strip hidden (${aliveNonEliminatedCount} non-eliminated — percents lock to 0 until 1–4 squads remain)`}
                </div>
                <div style={{ ...dash.wwcdBarTrack, maxWidth: "100%", marginTop: 10 }}>
                  <div
                    style={{
                      ...dash.wwcdBarFill,
                      width: `${wwcdPercentById.get(topRankedTeam.id) ?? 0}%`,
                      background: "#43e97b",
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <span style={{ color: "#8891a1" }}>Awaiting registrations…</span>
          )}
        </div>
      </div>
    </>
  );

  /* ════════════════════════════════════════════
     RENDER — existing UI is fully preserved
     ════════════════════════════════════════════ */
  return (
    <div style={dash.page}>
      <style>{`
        input.horus-hide-num-spin::-webkit-outer-spin-button,
        input.horus-hide-num-spin::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input.horus-hide-num-spin[type="number"] {
          -moz-appearance: textfield;
          appearance: textfield;
        }
        @keyframes rondoAdminGlow {
          0%, 100% {
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28);
          }
          50% {
            box-shadow: 0 8px 40px rgba(34, 211, 238, 0.22);
          }
        }
      `}</style>
      <input type="file" ref={logoInputRef} style={{ display: "none" }} accept="image/*" onChange={handleLogoChange} />
      <input type="file" ref={screenshotInputRef} style={{ display: "none" }} accept="image/*" multiple onChange={(e) => e.target.files.length > 0 && handleScreenshotUpload(e.target.files)} />

      <aside style={dash.sidebar} aria-label="Main navigation">
        <div style={dash.brandWrap}>
          <div style={dash.brandBadge}>🏆</div>
          <div style={dash.brandText}>
            <p style={dash.brandTitle}>Stiffler Bros Admin Panal</p>
            <p style={dash.brandSub}>
              {stats.total} teams · {stats.alive} alive
              {matchBoardMeta?.map === "rondo" && stats.rondoBenched ? ` · ${stats.rondoBenched} bench` : ""}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => goSection("dashboard")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "dashboard" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>⌂</span>
          <span style={{ flex: 1 }}>Dashboard</span>
        </button>

        <div style={dash.navGroupLab}>Live management</div>
        <button
          type="button"
          onClick={() => goSection("dashboard")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "dashboard" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>▴</span>
          <span style={{ flex: 1 }}>Live ranking</span>
          <span style={dash.navLiveBadge}>LIVE</span>
        </button>
        <button
          type="button"
          onClick={() => goSection("knock")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "knock" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>◎</span>
          <span style={{ flex: 1 }}>Knock control</span>
        </button>
        <button
          type="button"
          onClick={() => goSection("liveSignal")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "liveSignal" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>📡</span>
          <span style={{ flex: 1 }}>Live signal / preview</span>
        </button>
        <button
          type="button"
          onClick={() => goSection("zonePrediction")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "zonePrediction" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>◎</span>
          <span style={{ flex: 1 }}>Zone prediction</span>
        </button>
        <button
          type="button"
          onClick={() => goSection("announcements")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "announcements" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>📢</span>
          <span style={{ flex: 1 }}>Live announcements</span>
        </button>

        <div style={dash.navGroupLab}>Match management</div>
        <button
          type="button"
          onClick={() => goSection("match")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "match" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>⚡</span>
          <span style={{ flex: 1 }}>Match standings</span>
        </button>
        <button
          type="button"
          onClick={() => goSection("screenshot")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "screenshot" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>📸</span>
          <span style={{ flex: 1 }}>Screenshot AI</span>
        </button>
        <button
          type="button"
          onClick={() => goSection("history")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "history" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>📋</span>
          <span style={{ flex: 1 }}>Results history</span>
        </button>

        <div style={dash.navGroupLab}>Team management</div>
        <button
          type="button"
          onClick={() => goSection("register")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "register" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>👥</span>
          <span style={{ flex: 1 }}>Teams / players</span>
        </button>
        <button
          type="button"
          onClick={() => goSection("dashboard")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "dashboard" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>#</span>
          <span style={{ flex: 1 }}>Team points</span>
        </button>

        <div style={dash.navGroupLab}>Broadcast tools</div>
        <button
          type="button"
          onClick={() => goSection("overlay")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "overlay" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>🖥</span>
          <span style={{ flex: 1 }}>Overlay control</span>
        </button>
        <button
          type="button"
          onClick={() => goSection("obsTriplePng")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "obsTriplePng" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>🖼</span>
          <span style={{ flex: 1 }}>OBS PNG triple slot</span>
        </button>
        <button
          type="button"
          onClick={() => goSection("tournament")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "tournament" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>🏆</span>
          <span style={{ flex: 1 }}>Tournament</span>
        </button>
        <button
          type="button"
          onClick={() => goSection("googleSync")}
          style={{
            ...dash.navItem,
            ...(expandedSection === "googleSync" ? dash.navItemActive : {}),
          }}
        >
          <span aria-hidden>☁️</span>
          <span style={{ flex: 1 }}>Google sync</span>
        </button>

        <div style={dash.sidebarGrow} />
        <button
          type="button"
          style={dash.endLiveBtn}
          onClick={() => {
            if (window.confirm("End the live match?")) void endMatch();
          }}
        >
          <span aria-hidden>⏻</span>
          End live match
        </button>
      </aside>

      <div style={dash.mainShell}>
        <header style={dash.topbar}>
          <button type="button" style={dash.tbBtn} aria-label="Navigation" title="Navigation">
            ☰
          </button>

          <div style={{ ...dash.topbarMid, flexWrap: "wrap", gap: 10 }}>
            {currentMatch.status === "live" ? <span style={dash.livePillSm}>LIVE</span> : null}
            <button
              type="button"
              style={dash.restartCountTopBtn}
              onClick={() => void restartSeriesAtMatchOne()}
              aria-label="Restart count — Match number becomes 1, history and standings cleared"
              title="Match #1 · clears Match History · resets Overall Standings and all squad scores in this lobby"
            >
              Restart count
            </button>
            <label style={dash.screenReaderOnly} htmlFor="admin-match-banner">
              Match title
            </label>
            <input
              id="admin-match-banner"
              style={dash.matchBannerInput}
              placeholder={`MATCH ${currentMatch.number}`}
              autoCapitalize="characters"
              maxLength={72}
              value={currentMatch.matchLabel || ""}
              onChange={(e) => setCurrentMatch((p) => ({ ...p, matchLabel: e.target.value }))}
              onBlur={(e) => {
                void patchMatchMeta({ matchLabel: e.target.value.trim() });
              }}
              aria-label="Optional match banner text"
            />
            <span style={dash.matchDotMid} aria-hidden>
              ·
            </span>
            <label style={dash.screenReaderOnly} htmlFor="admin-match-map">
              Map
            </label>
            <select
              id="admin-match-map"
              aria-label="Map"
              style={dash.matchMapSel}
              value={currentMatch.map || "erangel"}
              onChange={(e) => {
                const map = e.target.value;
                setCurrentMatch((p) => ({ ...p, map }));
                void patchMatchMeta({ map });
              }}
            >
              {BGMI_MAP_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div style={dash.topbarRight}>
            <button
              type="button"
              style={dash.tbBtn}
              onClick={() =>
                document.documentElement.requestFullscreen?.().catch(() => {
                  setMessage("Fullscreen unavailable in this browser context.");
                })
              }
            >
              Fullscreen
            </button>
            <button type="button" style={dash.bellBtn} aria-label="Notifications (demo)">
              🔔
              <span style={dash.bellDot}>12</span>
            </button>
            <div style={dash.userChip}>
              <div style={dash.userDot}>AD</div>
              <div style={dash.userMeta}>
                <span style={dash.userName}>Admin</span>
                <span style={dash.userRole}>Super Admin</span>
              </div>
            </div>
          </div>
        </header>

        <div style={dash.messageStrip}>{message}</div>

        <div style={dash.scrollMain}>
          {chickenDinnerTeam ? (
            <div style={{ ...ns.chickenBanner, marginBottom: 14 }}>
              <span style={ns.chickenIcon}>🏆</span>
              WINNER WINNER CHICKEN DINNER — {chickenDinnerTeam.team}
              <span style={ns.chickenIcon}>🏆</span>
            </div>
          ) : null}

          {expandedSection === "dashboard" ? (
            <>
              <div style={dash.dashGrid}>
                <section style={{ ...dash.cardPanel, overflow: "hidden" }}>
                  <div style={dash.cardPanelHead}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                      <span style={dash.liveHdrBadge}>LIVE</span>
                      <h2 style={{ ...dash.rankingsHeadTitle, margin: 0 }}>Live rankings</h2>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() =>
                          window.open(`/overlay/themed?theme=${encodeURIComponent(activeOverlayTheme)}`, "_blank", "width=1920,height=1080")
                        }
                        style={dash.editRowBtn}
                      >
                        Open overlay
                      </button>
                      <span style={{ ...styles.badge, margin: 0 }}>{sortedTeams.length} teams</span>
                    </div>
                  </div>

                  <div style={dash.rankTableHead}>
                    <div>RANK</div>
                    <div>TEAM</div>
                    <div>ALIVE</div>
                    <div>KILLS</div>
                    <div>PTS</div>
                    <div style={{ textAlign: "right", paddingRight: 6 }}>WWCD</div>
                    <div style={{ textAlign: "center" }}>ACTION</div>
                  </div>

                  <div style={{ ...styles.rowsWrap, paddingBottom: 0 }}>
                    {sortedTeams.length === 0 ? (
                      <div style={{ ...styles.emptyState, margin: "0 16px", borderRadius: 12 }}>
                        No teams yet. Scroll to the panel on the right and add your squad.
                      </div>
                    ) : (
                      sortedTeams.map((team, index) => {
                        const active = team.id === selectedId;
                        const aliveSlots =
                          team.status === "eliminated"
                            ? 0
                            : Math.max(0, Math.min(4, Number(team.alivePlayers ?? 4)));
                        const pct = wwcdPercentById.get(team.id) ?? 0;
                        return (
                          <div
                            key={team.id}
                            style={{
                              ...dash.rankRow,
                              background: active
                                ? "linear-gradient(90deg, rgba(230,57,70,.14), rgba(18,21,28,.94))"
                                : index % 2 === 0
                                  ? "rgba(255,255,255,.02)"
                                  : "rgba(255,255,255,.035)",
                              borderLeft: active ? "3px solid #e63946" : "3px solid transparent",
                            }}
                          >
                            <div style={{ ...dash.rankNum, ...(active ? { color: "#e63946" } : {}) }}>{index + 1}</div>
                            <div style={styles.teamCell}>
                              <div
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") triggerLogoPick(team.id);
                                }}
                                style={{
                                  ...styles.teamLogo,
                                  ...(team.logo
                                    ? {
                                        backgroundImage: `url(${API}${team.logo})`,
                                        backgroundSize: "cover",
                                        backgroundPosition: "center",
                                        color: "transparent",
                                      }
                                    : {}),
                                }}
                                onClick={() => triggerLogoPick(team.id)}
                                title="Upload logo"
                              >
                                {team.logo ? "" : team.team.slice(0, 2)}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ ...styles.teamName, fontSize: 15 }}>{team.team}</div>
                                <div style={{ ...styles.teamSub, fontSize: 11 }}>
                                  {team.status.toUpperCase()}
                                  {team.positionPoints > 0 ? ` · +${team.positionPoints} pos` : ""}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              {[0, 1, 2, 3].map((i) => (
                                <div
                                  key={i}
                                  style={{
                                    ...dash.aliveSlot,
                                    fontSize: 11,
                                    background: i < aliveSlots ? "rgba(67,233,123,.12)" : "rgba(255,255,255,.04)",
                                    color: i < aliveSlots ? "#43e97b" : "#5c6370",
                                    border: `1px solid ${i < aliveSlots ? "rgba(67,233,123,.42)" : "rgba(255,255,255,.07)"}`,
                                  }}
                                  title={i < aliveSlots ? "Alive" : "Down"}
                                >
                                  👤
                                </div>
                              ))}
                            </div>
                            <div style={{ ...styles.valueCell, fontWeight: 900 }}>{team.finishes}</div>
                            <div style={{ ...styles.valueCell, fontWeight: 900 }}>{team.points}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontWeight: 900, minWidth: 34, textAlign: "right", color: "#e8eaed" }}>{pct}%</span>
                              <div style={dash.wwcdBarTrack}>
                                <div
                                  style={{
                                    ...dash.wwcdBarFill,
                                    width: `${pct}%`,
                                    background:
                                      pct > 33 ? "#43e97b" : pct > 14 ? "#fbbf24" : "rgba(255,255,255,.22)",
                                  }}
                                />
                              </div>
                            </div>
                            <div style={{ ...styles.actionWrap, justifyContent: "center", gap: 8 }}>
                              <button type="button" onClick={() => selectTeam(team)} style={dash.editRowBtn}>
                                ✎ Edit
                              </button>
                              <button type="button" style={dash.iconBtnMuted} onClick={() => deleteTeam(team.id)} title="Delete team">
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div style={dash.addTeamFooterBtn}>
                    <button
                      type="button"
                      style={dash.addTeamMainBtn}
                      onClick={handleFooterAddTeam}
                      title="Add team: fills from the Live Control form — instant when team name is set"
                    >
                      + Add team
                    </button>
                  </div>
                </section>

                <div style={dash.sideStack}>
          <aside style={{ ...styles.formCard, position: "relative", top: "auto" }}>
            <div style={styles.cardHeaderAlt}>
              <div>
                <p style={styles.cardLabel}>LIVE CONTROL</p>
                <h2 style={styles.cardTitle}>Create / Update Team</h2>
              </div>
            </div>

            <form
              ref={teamFormAnchorRef}
              style={styles.formGrid}
              aria-label="Create or update team"
              onSubmit={(e) => e.preventDefault()}
            >
              <Field label="Team name">
                <input
                  ref={teamNameInputRef}
                  style={styles.input}
                  value={form.team}
                  onChange={(e) =>
                    setForm({ ...form, team: e.target.value.toUpperCase() })
                  }
                  placeholder="ENTER TEAM NAME"
                />
              </Field>

              <Field label="Status">
                <div style={styles.statusSegmentRow} role="group" aria-label="Team status">
                  {[
                    { id: "alive", label: "Alive", fg: "#061210", bg: "linear-gradient(180deg, #5CFF72, #3ad65a)", ring: "rgba(92,255,114,.85)" },
                    { id: "knocked", label: "Knocked", fg: "#1a0a06", bg: "linear-gradient(180deg, #FF9A6B, #FF6B45)", ring: "rgba(255,107,69,.85)" },
                    { id: "eliminated", label: "Eliminated", fg: "#fff7f7", bg: "linear-gradient(180deg, #E85D6B, #c03950)", ring: "rgba(255,107,120,.9)" },
                  ].map((s) => {
                    const on = form.status === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setForm({ ...form, status: s.id })}
                        style={{
                          flex: 1,
                          minHeight: 46,
                          padding: "10px 8px",
                          borderRadius: 12,
                          border: on ? `2px solid ${s.ring}` : "2px solid rgba(255,255,255,.14)",
                          background: on ? s.bg : "rgba(6,18,22,.85)",
                          color: on ? s.fg : "#B8D4DA",
                          fontWeight: 900,
                          fontSize: 13,
                          letterSpacing: 0.6,
                          cursor: "pointer",
                          textTransform: "uppercase",
                          boxShadow: on ? "0 6px 20px rgba(0,0,0,.35)" : "inset 0 1px 0 rgba(255,255,255,.04)",
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div style={{ ...styles.inlineFields, gridTemplateColumns: "repeat(3, 1fr)" }}>
                <NumberStepField label="Kills" min={0} value={form.finishes} onChange={(v) => setForm({ ...form, finishes: v })} />
                <NumberStepField label="Total points" min={0} value={form.points} onChange={(v) => setForm({ ...form, points: v })} />
                <NumberStepField
                  label="Screen order"
                  min={0}
                  max={99999}
                  value={form.displayOrder}
                  onChange={(v) => setForm({ ...form, displayOrder: v })}
                />
              </div>
              <p style={{ margin: "-6px 0 4px", color: "#5a7a82", fontSize: 11, lineHeight: 1.35 }}>
                Screen order **locks this row number** on Live Rankings (1 = rank #1, 5 = rank #5). **0** means auto:
                fills any row not taken by numbered teams — order among autos is stable by squad id (not alphabetical).
              </p>

              <div style={styles.buttonRow}>
                <button type="button" onClick={createTeam} style={styles.primaryBtn}>
                  Add Team
                </button>
                <button type="button" onClick={updateTeam} style={styles.secondaryBtn}>
                  Update Selected
                </button>
              </div>

              {selectedTeam && (
                <div style={ns.logoSection}>
                  <span style={styles.fieldLabel}>TEAM LOGO</span>
                  <div style={ns.logoRow}>
                    <div
                      style={{
                        ...ns.logoPreview,
                        ...(selectedTeam.logo
                          ? {
                              backgroundImage: `url(${API}${selectedTeam.logo})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              color: "transparent",
                            }
                          : {}),
                      }}
                    >
                      {selectedTeam.logo ? "" : selectedTeam.team.slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <button
                        type="button"
                        onClick={() => triggerLogoPick(selectedTeam.id)}
                        style={ns.logoUploadBtn}
                      >
                        {selectedTeam.logo ? "Change Logo" : "Upload Logo"}
                      </button>
                      <p style={{ margin: "6px 0 0", color: "#5a7a82", fontSize: 11 }}>
                        PNG, JPG, SVG — appears on overlay
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!selectedTeam && (
                <div style={ns.logoSection}>
                  <span style={styles.fieldLabel}>TEAM LOGO (optional)</span>
                  <div style={ns.logoRow}>
                    <div
                      style={{
                        ...ns.logoPreview,
                        ...(pendingNewLogo?.url
                          ? {
                              backgroundImage: `url(${pendingNewLogo.url})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              color: "transparent",
                            }
                          : {}),
                      }}
                    >
                      {pendingNewLogo?.url ? "" : String(form.team || "??").slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <button type="button" onClick={() => triggerLogoPick("new")} style={ns.logoUploadBtn}>
                          {pendingNewLogo ? "Change logo" : "Choose logo"}
                        </button>
                        {pendingNewLogo ? (
                          <button
                            type="button"
                            onClick={() => {
                              clearPendingNewLogo();
                              setMessage("Pending logo cleared.");
                            }}
                            style={{
                              ...ns.logoUploadBtn,
                              background: "rgba(180,70,85,.18)",
                              borderColor: "rgba(255,120,135,.35)",
                              color: "#FFD0D8",
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <p style={{ margin: 0, color: "#5a7a82", fontSize: 11 }}>
                        Logo uploads automatically right after Add Team succeeds. PNG, JPG, SVG.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </aside>

                  <div style={dash.sideCard}>
                    <div style={dash.sideCardTitle}>Quick controls</div>
                    <div style={dash.quickGrid}>
                      <button
                        type="button"
                        style={{ ...dash.quickBtn("linear-gradient(160deg,#3b82f6,#2563eb)") }}
                        onClick={() => void refreshRankings()}
                        aria-label="Update rankings from server"
                      >
                        <span style={{ fontSize: 20 }}>⇅</span>
                        Update rankings
                      </button>
                      <button
                        type="button"
                        style={{ ...dash.quickBtn("linear-gradient(160deg,#8b5cf6,#7c3aed)") }}
                        onClick={() =>
                          window.open(`/overlay/themed?theme=${encodeURIComponent(activeOverlayTheme)}`, "_blank", "width=1920,height=1080")
                        }
                      >
                        <span style={{ fontSize: 20 }}>⛶</span>
                        Send to overlay
                      </button>
                      <button type="button" style={{ ...dash.quickBtn("linear-gradient(160deg,#e63946,#b91c1c)") }} onClick={() => goSection("knock")}>
                        <span style={{ fontSize: 20 }}>◎</span>
                        Knock / kills
                      </button>
                      <button
                        type="button"
                        style={{ ...dash.quickBtn("linear-gradient(160deg,#22c55e,#15803d)") }}
                        onClick={() => goSection("zonePrediction")}
                      >
                        <span style={{ fontSize: 20 }}>◎</span>
                        Zone cue
                      </button>
                      <button
                        type="button"
                        style={{ ...dash.quickBtn("linear-gradient(160deg,#f59e0b,#d97706)") }}
                        onClick={() => goSection("announcements")}
                      >
                        <span style={{ fontSize: 20 }}>📢</span>
                        Announcements
                      </button>
                      <button
                        type="button"
                        style={{ ...dash.quickBtn("linear-gradient(160deg,#3f4654,#2a313b)", "#e8eaed") }}
                        onClick={() => void restartSeriesAtMatchOne()}
                        title="Same as top bar Restart count — Match #1, clear history & standings"
                      >
                        <span style={{ fontSize: 20 }}>↺</span>
                        Restart count (#1)
                      </button>
                    </div>
                  </div>

                  <div style={dash.sideCard}>
                    <div style={dash.sideCardTitle}>Match information</div>
                    <div style={dash.kvRow}>
                      <span style={dash.kvKey}>Match #</span>
                      <span style={{ ...dash.kvVal, textAlign: "right" }}>
                        <input
                          className="horus-hide-num-spin"
                          type="number"
                          min={1}
                          max={99999}
                          aria-label="Match number"
                          style={{ ...dash.matchMetaFieldInput, width: 76 }}
                          value={currentMatch.number}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (!Number.isFinite(n)) return;
                            setCurrentMatch((p) => ({
                              ...p,
                              number: Math.max(1, Math.min(99999, Math.floor(n))),
                            }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            const n = Math.max(1, Math.min(99999, Math.floor(Number(e.currentTarget.value)) || 1));
                            void submitMatchNumberFromInput(n);
                          }}
                          onBlur={(e) => {
                            const n = Math.max(1, Math.min(99999, Math.floor(Number(e.target.value)) || 1));
                            void submitMatchNumberFromInput(n);
                          }}
                        />
                      </span>
                    </div>
                    <p style={{ margin: "-4px 0 10px", fontSize: 10, color: "#6b8490", lineHeight: 1.45 }}>
                      Saving <strong style={{ color: "#9fb8bf" }}>Match #1</strong> after being on #2+ clears history and resets every squad&apos;s scores (confirm dialog).
                    </p>
                    <div style={dash.kvRow}>
                      <label style={{ ...dash.kvKey, margin: 0, cursor: "pointer" }} htmlFor="dash-match-map-select">
                        Map
                      </label>
                      <span style={{ ...dash.kvVal, textAlign: "right" }}>
                        <select
                          id="dash-match-map-select"
                          aria-label="Map"
                          style={dash.matchMetaFieldSelect}
                          value={currentMatch.map || "erangel"}
                          onChange={(e) => {
                            const map = e.target.value;
                            setCurrentMatch((p) => ({ ...p, map }));
                            void patchMatchMeta({ map });
                          }}
                        >
                          {BGMI_MAP_OPTS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </span>
                    </div>
                    <div style={dash.kvRow}>
                      <span style={dash.kvKey}>Status</span>
                      <span style={{ ...dash.kvVal, color: currentMatch.status === "live" ? "#43e97b" : "#8891a1" }}>
                        {(currentMatch.status || "—").toUpperCase()}
                      </span>
                    </div>
                    <div style={dash.kvRow}>
                      <span style={dash.kvKey}>Start</span>
                      <span style={dash.kvVal}>{startTimeLabel}</span>
                    </div>
                    <div style={{ ...dash.kvRow, marginTop: 6, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                      <span style={dash.kvKey}>Elapsed</span>
                      <span style={{ ...dash.kvVal, fontFamily: "ui-monospace, monospace" }}>{elapsedLabel}</span>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 12, fontWeight: 700, color: "#cfd5df", cursor: "pointer" }}>
                      <input type="checkbox" checked={autoCalculate} onChange={toggleAutoCalc} style={ns.checkbox} />
                      Auto-calculate points
                    </label>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => void startNewMatch()} style={ns.matchBtnPrimary}>
                        New match (next #)
                      </button>
                      <button type="button" onClick={() => endMatch()} style={ns.matchBtn}>
                        End match
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ ...dash.overlayFooter, marginTop: 0 }}>
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#8b929e", marginBottom: 8 }}>
                    BROWSER SOURCE URL (SERIES PTS + FIN DEFAULT)
                  </div>
                  <div style={{ fontSize: 11, color: "#8891a1", marginBottom: 8, lineHeight: 1.45 }}>
                    Adds up every match you close with <strong style={{ color: "#cbd5df" }}>End Match</strong> or{" "}
                    <strong style={{ color: "#cbd5df" }}>New Match</strong> (next round — Match # goes up). Use{" "}
                    <strong style={{ color: "#cbd5df" }}>Restart count</strong> in the top bar (or Quick controls) for a full reset to Match #1. Same math as{" "}
                    <strong style={{ color: "#cbd5df" }}>Tournament → Overall standings</strong>. Auto-updates over Socket.IO.
                  </div>
                  <div style={dash.overlayUrlBox}>
                    <input readOnly style={dash.overlayUrlInput} value={overlayBrowserUrl} aria-label="Themed overlay URL (series totals default)" />
                    <button type="button" style={dash.overlayCopyBtn} onClick={() => void copyOverlayUrl()}>
                      Copy
                    </button>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.8, color: "#8b929e", marginTop: 12, marginBottom: 8 }}>
                    CURRENT MATCH ONLY
                  </div>
                  <div style={{ fontSize: 11, color: "#8891a1", marginBottom: 8, lineHeight: 1.45 }}>
                    Same board but FIN / TOTAL show this lobby only — URL includes{" "}
                    <code style={{ color: "#F1CF69", fontSize: 11 }}>live=1</code>.
                  </div>
                  <div style={dash.overlayUrlBox}>
                    <input readOnly style={dash.overlayUrlInput} value={overlayMatchOnlyUrl} aria-label="Match-only themed overlay URL" />
                    <button type="button" style={dash.overlayCopyBtn} onClick={() => void copyMatchOnlyUrl()}>
                      Copy
                    </button>
                  </div>
                </div>
                <div style={dash.overlayStatusRow}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      flexShrink: 0,
                      background: socketConnected ? "#43e97b" : "#e63946",
                      boxShadow: socketConnected ? "0 0 12px rgba(67,233,123,.65)" : "none",
                    }}
                  />
                  <span style={{ fontWeight: 800, fontSize: 13 }}>
                    {socketConnected ? "Socket connected" : "Reconnecting socket…"}
                  </span>
                  <button type="button" style={dash.tbBtn} onClick={() => void refreshRankings()}>
                    Refresh data
                  </button>
                  <button type="button" style={dash.tbBtn} onClick={() => socket.emit("requestMatch")}>
                    Sync match
                  </button>
                </div>
              </div>
            </>
          ) : null}


        {expandedSection !== "dashboard" && (
        <div style={{ ...ns.matchBar, marginTop: 4, marginBottom: 12 }}>
          <div style={ns.matchInfo}>
            <span style={ns.matchBadge}>MATCH #{currentMatch.number}</span>
            <span style={{ ...ns.matchStatus, color: currentMatch.status === "live" ? "#5CFF72" : "#A5B4BF" }}>
              {currentMatch.status === "live" ? "● LIVE" : "● ENDED"}
            </span>
          </div>
          <div style={ns.matchActions}>
            <label style={ns.autoCalcLabel}>
              <input type="checkbox" checked={autoCalculate} onChange={toggleAutoCalc} style={ns.checkbox} />
              Auto-Calculate Points
            </label>
            <button onClick={() => void endMatch()} style={ns.matchBtn}>
              End Match
            </button>
            <button onClick={() => void startNewMatch()} style={ns.matchBtnPrimary}>
              New Match (next #)
            </button>
          </div>
        </div>
        )}

        {expandedSection === "liveSignal" && (
          <div style={dash.liveSignalsPage}>
            <div style={{ marginBottom: 20 }}>
              <p style={styles.cardLabel}>LIVE READOUTS</p>
              <h2 style={{ ...styles.cardTitle, marginBottom: 6 }}>Live signal · top squad preview</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#8891a1", fontWeight: 600, maxWidth: 640, lineHeight: 1.5 }}>
                Standing snapshot strip and WWCD preview (same percentages as{" "}
                <code style={{ color: "#F1CF69", fontSize: 12 }}>/overlay/wwcd-only</code> when 1–4 squads remain).
              </p>
            </div>
            <div style={dash.liveSignalsGrid}>{liveSignalsPanel}</div>
          </div>
        )}

        {expandedSection === "zonePrediction" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>BROADCAST ZONE</p>
                <h2 style={{ ...styles.cardTitle, marginBottom: 8 }}>Zone prediction cue</h2>
                <p style={{ margin: 0, fontSize: 13, color: "#8891a1", fontWeight: 600, maxWidth: 640, lineHeight: 1.5 }}>
                  Separate OBS browser source:{" "}
                  <code style={{ color: "#F1CF69", fontSize: 12 }}>/overlay/zone-prediction</code> — not mixed with the match board (
                  <code style={{ color: "#8891a1", fontSize: 11 }}>/overlay/themed</code>).
                </p>
                <button
                  type="button"
                  style={{ ...ns.matchBtn, marginTop: 10 }}
                  onClick={() => window.open(zonePredictionObsUrl, "_blank", "width=1920,height=1080")}
                >
                  Open zone overlay URL
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: "#6b8490", letterSpacing: 1.1, marginBottom: 6, textTransform: "uppercase" }}>Headline</div>
                <input
                  style={{ ...styles.matchBannerInput, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
                  value={zoneCueHeadline}
                  onChange={(e) => setZoneCueHeadline(e.target.value)}
                  placeholder="e.g. NEXT SAFE — PHASE 3"
                  autoComplete="off"
                />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: "#6b8490", letterSpacing: 1.1, marginBottom: 6, textTransform: "uppercase" }}>Detail (optional)</div>
                <input
                  style={{ ...styles.matchBannerInput, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
                  value={zoneCueSubtitle}
                  onChange={(e) => setZoneCueSubtitle(e.target.value)}
                  placeholder="e.g. Ridgeline sector"
                  autoComplete="off"
                />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button type="button" style={ns.matchBtnPrimary} onClick={() => void broadcastZoneCueToOverlay()}>
                  Send to overlay
                </button>
                <button type="button" style={ns.matchBtn} onClick={() => void clearZoneCueOverlay()}>
                  Clear from overlay
                </button>
              </div>
            </div>
          </section>
        )}

        {expandedSection === "announcements" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>BROADCAST TICKER</p>
                <h2 style={{ ...styles.cardTitle, marginBottom: 8 }}>Live announcements</h2>
                <p style={{ margin: 0, fontSize: 13, color: "#8891a1", fontWeight: 600, maxWidth: 640, lineHeight: 1.5 }}>
                  Separate OBS source: <code style={{ color: "#F1CF69", fontSize: 12 }}>/overlay/announcements</code> — banner only, ~9s dismiss. Independent of{" "}
                  <code style={{ color: "#8891a1", fontSize: 11 }}>/overlay/themed</code>.
                </p>
                <button
                  type="button"
                  style={{ ...ns.matchBtn, marginTop: 10 }}
                  onClick={() => window.open(liveAnnouncementsObsUrl, "_blank", "width=1920,height=1080")}
                >
                  Open announcements overlay URL
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560 }}>
              <textarea
                value={announcementDraft}
                onChange={(e) => setAnnouncementDraft(e.target.value)}
                placeholder="e.g. Technical pause — standby"
                rows={4}
                style={{
                  ...styles.matchBannerInput,
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  resize: "vertical",
                  minHeight: 100,
                  textTransform: "none",
                  fontWeight: 700,
                  lineHeight: 1.45,
                }}
              />
              <button type="button" style={ns.matchBtnPrimary} onClick={() => void broadcastAnnouncementToOverlay()}>
                Broadcast to overlay
              </button>
            </div>
          </section>
        )}

        {/* ── Knock Control Panel ── */}
        {expandedSection === "knock" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>{rondoKnockMode ? "RONDO LIVE MATRIX" : "LIVE KNOCK TRACKING"}</p>
                <h2 style={{ ...styles.cardTitle, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                  {rondoKnockMode ? (
                    <>
                      <span style={ns.rondoTitleBadge}>RONDO MAP</span>
                      <span>Recall · Knock broadcast desk</span>
                    </>
                  ) : (
                    "Team Knock Control"
                  )}
                </h2>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#8891a1", fontWeight: 600, maxWidth: 820, lineHeight: 1.45 }}>
                  {rondoKnockMode ? (
                    <>
                      Full production layout below — states, recall gate, and OBS strip follow your original Rondo spec. Match header must stay on{" "}
                      <strong style={{ color: "#7eebfb" }}>RONDO</strong> so the server benches first wipes (not immediate placement). If a team still goes straight to rank
                      #, hard-refresh admin and confirm <code style={{ color: "#8891a1", fontSize: 11 }}>POST /match/meta</code> saved map=rondo.
                    </>
                  ) : (
                    <>
                      OBS finish strips (red pill + skull, live from socket):{" "}
                      <code style={{ color: "#F1CF69", fontSize: 11 }}>/overlay/finish-badges</code>. Add{" "}
                      <code style={{ color: "#8891a1", fontSize: 11 }}>?interactive=1</code> to bump finishes from the browser.{" "}
                      <code style={{ color: "#8891a1", fontSize: 11 }}>?stable=1</code> matches fixed row order (no resort).
                    </>
                  )}
                </p>
                {!rondoKnockMode ? (
                  <button type="button" style={{ ...ns.matchBtn, marginTop: 8 }} onClick={() => window.open(finishBadgesObsUrl, "_blank", "width=520,height=960")}>
                    Open finish badges overlay
                  </button>
                ) : null}
              </div>
            </div>
            {!rondoKnockMode ? (
              <div style={ns.knockGrid}>
                {knockStableOrderTeams.map((team, idx) => {
                  const alive = team.alivePlayers ?? 4;
                  const isOut = team.status === "eliminated";
                  const rowNumVal = getKnockControlDisplayNumber(team.id, idx);
                  const minSelectable = idx > 0 ? getKnockControlDisplayNumber(knockStableOrderTeams[idx - 1].id, idx - 1) + 1 : 1;
                  return (
                    <div key={team.id} style={{ ...ns.knockRow, opacity: isOut ? 0.4 : 1 }}>
                      <div style={ns.knockTeamNum}>
                        <span style={ns.knockTeamNumLabel}>Team #</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          aria-label={`Team number for ${team.team}`}
                          title="Teams below adjust automatically · must stay above row above · no duplicates"
                          min={minSelectable}
                          max={99999}
                          value={rowNumVal}
                          onChange={(e) => commitKnockRowNumberFromIndex(idx, e.target.value)}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "4px 4px",
                            fontSize: 13,
                            fontWeight: 900,
                            textAlign: "center",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,.14)",
                            background: "rgba(0,0,0,.32)",
                            color: "#e8eef5",
                          }}
                        />
                      </div>
                      <div style={ns.knockTeam}>
                        <div
                          style={{
                            ...styles.teamLogo,
                            width: 32,
                            height: 32,
                            fontSize: 11,
                            borderRadius: 8,
                            ...(team.logo ? { backgroundImage: `url(${API}${team.logo})`, backgroundSize: "cover", color: "transparent" } : {}),
                          }}
                        >
                          {team.logo ? "" : team.team.slice(0, 2)}
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{team.team}</span>
                      </div>
                      <div style={ns.aliveBars}>
                        {[0, 1, 2, 3].map((i) => (
                          <span key={i} style={{ ...ns.aliveBar, background: i < alive ? "#5CFF72" : team.status === "knocked" ? "#FF6B45" : "#3a3f48" }} />
                        ))}
                        <span style={{ color: "#8CB7BE", fontSize: 12, marginLeft: 6 }}>{alive}/4</span>
                      </div>
                      <div style={ns.knockFinishPts} aria-label="Finish points (kills)">
                        <span style={ns.knockFinishPtsLabel}>Finishes</span>
                        <div style={ns.knockFinishPtsCtl}>
                          <button
                            type="button"
                            style={ns.knockFinishArrowBtn}
                            title="Raise finish points"
                            aria-label="Increase finishes"
                            onClick={() => void adjustTeamFinishes(team, 1)}
                          >
                            ▲
                          </button>
                          <span style={ns.knockFinishPtsValue}>{Number(team.finishes) || 0}</span>
                          <button
                            type="button"
                            style={ns.knockFinishArrowBtn}
                            title="Lower finish points"
                            aria-label="Decrease finishes"
                            onClick={() => void adjustTeamFinishes(team, -1)}
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <div style={ns.knockBtns}>
                        <button style={ns.knockBtn} disabled={isOut} onClick={() => setAlive(team.id, 3)} title="1 Knocked">
                          1K
                        </button>
                        <button style={ns.knockBtn} disabled={isOut} onClick={() => setAlive(team.id, 2)} title="2 Knocked">
                          2K
                        </button>
                        <button style={ns.knockBtn} disabled={isOut} onClick={() => setAlive(team.id, 1)} title="3 Knocked">
                          3K
                        </button>
                        <button style={{ ...ns.knockBtn, ...ns.knockBtnDanger }} disabled={isOut} onClick={() => knockTeam(team.id, 4, true)} title="Full Eliminated">
                          OUT
                        </button>
                        {isOut && team.eliminationRank ? <span style={ns.rankBadge}>#{team.eliminationRank}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <RondoKnockMatrix
                teams={knockStableOrderTeams}
                apiBase={API}
                teamLogoStyle={{}}
                styles={styles}
                ns={ns}
                knockTeam={knockTeam}
                setAlive={setAlive}
                adjustTeamFinishes={adjustTeamFinishes}
                triggerRondoRecall={triggerRondoRecall}
                undoRondoMistakenBench={undoRondoMistakenBench}
                finalizeBenchedElimination={finalizeBenchedElimination}
                finishBadgesObsUrl={finishBadgesObsUrl}
                getKnockControlDisplayNumber={getKnockControlDisplayNumber}
                commitKnockRowNumberFromIndex={commitKnockRowNumberFromIndex}
              />
            )}
          </section>
        )}

        {/* ── Match Stats ── */}
        {expandedSection === "match" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <p style={styles.cardLabel}>CURRENT MATCH</p>
              <h2 style={styles.cardTitle}>Match #{currentMatch.number} Standings</h2>
            </div>
            <div style={ns.matchTable}>
              <div style={ns.matchTableHead}>
                <div>#</div><div>Team</div><div>Status</div><div>Alive</div><div>Kills</div><div>Pos. Pts</div><div>Total</div>
              </div>
              {teams.map((t, i) => (
                <div key={t.id} style={{ ...ns.matchTableRow, background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)" }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{i + 1}</div>
                  <div style={{ fontWeight: 800 }}>{t.team}</div>
                  <div>
                    {(() => {
                      const s = String(t.status || "").toLowerCase();
                      if (s === "rondo_benched") {
                        return (
                          <span style={{ color: "#67e8f9", fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Recall bench
                          </span>
                        );
                      }
                      if (s === "eliminated" && t.rondoRecallConsumed) {
                        return (
                          <span style={{ color: "#fca5a5", fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>Eliminated · final</span>
                        );
                      }
                      return (
                        <span style={{ color: s === "alive" ? "#5CFF72" : s === "knocked" ? "#FF6B45" : "#A5B4BF", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
                          {t.status}
                        </span>
                      );
                    })()}
                  </div>
                  <div>{t.alivePlayers ?? 4}/4</div>
                  <div style={{ fontWeight: 800 }}>{t.finishes}</div>
                  <div style={{ fontWeight: 800, color: "#F1CF69" }}>{t.positionPoints || 0}</div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: "#55efc4" }}>{t.points}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Screenshot Upload & AI (Multi-file) ── */}
        {expandedSection === "screenshot" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>AI SCREENSHOT DETECTION</p>
                <h2 style={styles.cardTitle}>Upload Match Screenshots</h2>
              </div>
              {screenshotResults && screenshotResults.length > 0 && (
                <button style={ns.matchBtnPrimary} onClick={applyScreenshotData}>Apply All Data</button>
              )}
            </div>

            <div style={ns.screenshotArea}>
              <div
                style={ns.dropZone}
                onClick={() => screenshotInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files.length > 0) handleScreenshotUpload(e.dataTransfer.files);
                }}
              >
                {processingScreenshot ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={ns.spinner} />
                    <p style={{ color: "#8CB7BE", marginTop: 12 }}>Processing screenshots with OCR...</p>
                  </div>
                ) : screenshotPreviews.length > 0 ? (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                    {screenshotPreviews.map((src, i) => (
                      <img key={i} src={src} alt={`Screenshot ${i + 1}`} style={{ ...ns.screenshotImg, maxHeight: 180 }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
                    <p style={{ color: "#8CB7BE", margin: 0, fontWeight: 700 }}>Click or drag multiple screenshots here</p>
                    <p style={{ color: "#5a7a82", fontSize: 12, marginTop: 6 }}>Select multiple files at once — all processed in one click</p>
                  </div>
                )}
              </div>

              {screenshotResults && screenshotResults.length > 0 && (
                <div style={ns.ocrResults}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#ECF8FB" }}>
                    Detected {screenshotResults.length} entries — Edit below, then click "Apply All Data"
                  </h3>
                  <div style={ns.ocrTable}>
                    <div style={{ ...ns.ocrHead, gridTemplateColumns: "60px 1fr 80px 80px 120px" }}>
                      <div>Rank</div><div>Team</div><div>Kills</div><div>Points</div><div>Source</div>
                    </div>
                    {screenshotResults.map((r, i) => (
                      <div key={i} style={{ ...ns.ocrRow, gridTemplateColumns: "60px 1fr 80px 80px 120px" }}>
                        <input style={ns.ocrInput} type="number" value={r.rank} onChange={(e) => updateScreenshotRow(i, "rank", e.target.value)} />
                        <input style={ns.ocrInput} value={r.team} onChange={(e) => updateScreenshotRow(i, "team", e.target.value.toUpperCase())} />
                        <input style={ns.ocrInput} type="number" value={r.finishes} onChange={(e) => updateScreenshotRow(i, "finishes", e.target.value)} />
                        <input style={ns.ocrInput} type="number" value={r.points} onChange={(e) => updateScreenshotRow(i, "points", e.target.value)} />
                        <span style={{ color: "#5a7a82", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.source || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {screenshotResults && screenshotResults.length === 0 && !processingScreenshot && (
                <div style={{ padding: 16, color: "#A5B4BF", textAlign: "center" }}>
                  No data detected. Enter results manually or try clearer screenshots.
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Team Registration ── */}
        {expandedSection === "register" && (
          <TeamRegisterSection teams={teams} API={API} onMessage={setMessage} />
        )}

        {/* ── Match History ── */}
        {expandedSection === "history" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>MATCH ARCHIVE</p>
                <h2 style={styles.cardTitle}>Match History</h2>
              </div>
              <button onClick={fetchHistory} style={ns.matchBtn}>Refresh</button>
            </div>

            {matchHistory.length === 0 ? (
              <div style={{ padding: 24, color: "#8CB7BE", textAlign: "center" }}>No match history yet. Complete a match to see it here.</div>
            ) : (
              <div style={ns.historyList}>
                {matchHistory.map((m) => (
                  <div key={m.id} style={ns.historyCard}>
                    <div style={ns.historyHeader}>
                      <div>
                        <span style={ns.historyBadge}>Match #{m.number}</span>
                        {m.winner && <span style={ns.winnerBadge}>🏆 {m.winner}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={ns.matchBtn} onClick={() => restoreMatch(m.id)}>Restore</button>
                        <button style={{ ...ns.matchBtn, borderColor: "#6B2B3B", color: "#FFDCE2", background: "#3A1620" }} onClick={() => deleteMatch(m.id)}>Delete</button>
                      </div>
                    </div>
                    <div style={ns.historyTeams}>
                      {(m.teams || []).slice(0, 5).map((t, i) => (
                        <span key={i} style={ns.historyTeamChip}>
                          #{i + 1} {t.team} — {t.points}pts
                        </span>
                      ))}
                      {(m.teams || []).length > 5 && (
                        <span style={{ color: "#5a7a82", fontSize: 12 }}>+{m.teams.length - 5} more</span>
                      )}
                    </div>
                    <div style={{ color: "#5a7a82", fontSize: 11, marginTop: 8 }}>
                      {new Date(m.startedAt).toLocaleString()} — {m.endedAt ? new Date(m.endedAt).toLocaleString() : "ongoing"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Overlay Controls ── */}
        {expandedSection === "overlay" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>BROADCAST CONTROLS</p>
                <h2 style={styles.cardTitle}>Overlay & Preview</h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <select
                  value={activeOverlayTheme}
                  onChange={(e) => setActiveOverlayTheme(e.target.value)}
                  style={styles.overlayThemeSelect}
                >
                  {["esports","premiumGold","neon","cyberpunk","minimal","cleanBroadcast","pubgTournament","futuristic","darkGlass","rgbAnimated","compactPro","streamerStyle"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    await fetch(`${API}/overlay/active-theme`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: activeOverlayTheme }) });
                    setMessage("Theme applied live!");
                  }}
                  style={{ ...ns.matchBtnPrimary, padding: "8px 16px", fontSize: 12 }}
                >
                  Save & Apply
                </button>
              </div>
            </div>

            <div style={ns.overlayGrid}>
              <div style={{ ...ns.overlayCard, display: "flex", flexDirection: "column", gap: 12, cursor: "default" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => window.open("/overlay/themed/overall", "_blank", "width=1920,height=1080")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      window.open("/overlay/themed/overall", "_blank", "width=1920,height=1080");
                    }
                  }}
                  style={{ cursor: "pointer", flex: 1 }}
                >
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Overall Tournament</div>
                  <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>Cumulative standings</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedSection("tournament");
                    setTimeout(() => overallBgSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
                  }}
                  style={{
                    marginTop: 4,
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.02,
                    borderRadius: 10,
                    border: "1px solid rgba(115,231,190,.35)",
                    background: "rgba(56,189,248,.1)",
                    color: "#73E7BE",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Upload custom PNG for this overlay →
                </button>
              </div>
              <div style={ns.overlayCard} onClick={() => window.open("/overlay/wwcd", "_blank", "width=1920,height=1080")}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🍗</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>WWCD Screen</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>Open WWCD overlay window</div>
              </div>
              <div
                style={ns.overlayCard}
                onClick={() =>
                  window.open(
                    `/overlay/wwcd-only?position=bottom&theme=${encodeURIComponent(activeOverlayTheme)}`,
                    "_blank",
                    "width=1920,height=1080",
                  )
                }
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>📉</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>WWCD 4-squad strip</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>
                  Transparent OBS URL: WWCD strip only (1–4 squads alive; nothing else)
                </div>
              </div>
              <div style={ns.overlayCard} onClick={() => sendOverlayCommand({ type: "toggleFullscreen" })}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🔲</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Fullscreen Toggle</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>Toggle overlay fullscreen</div>
              </div>
              <div style={ns.overlayCard} onClick={() => window.open(`/overlay/elimination`, "_blank", "width=1920,height=1080")}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>💀</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Elimination Banner</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>Opens in separate window</div>
              </div>
              <div style={ns.overlayCard} onClick={() => window.open("/overlay/side-banner", "_blank", "width=980,height=360")}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>▦</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Side match banner</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>
                  Tournament logo · group/match · map name — separate OBS source (/overlay/side-banner)
                </div>
              </div>
              <div style={ns.overlayCard} onClick={() => window.open("/overlay/themes", "_blank")}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>👁️</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Theme Preview</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>Classic overlay themes (visual grid)</div>
              </div>
              <div style={ns.overlayCard} onClick={() => window.open("/overlay/engine-catalog", "_blank")}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎨</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Theme & Design</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>Broadcast engine: names, pairs & URLs</div>
              </div>
            </div>

            {/* Side match banner — /overlay/side-banner (transparent OBS strip) */}
            <div style={{ marginTop: 14, padding: "16px 18px", background: "rgba(255,160,72,.06)", borderRadius: 14, border: "1px solid rgba(255,170,92,.28)" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#FFB86B", marginBottom: 10, letterSpacing: 0.5 }}>Side match banner controls</div>
              <p style={{ margin: "0 0 14px", color: "#8CB7BE", fontSize: 12, lineHeight: 1.55, maxWidth: 860 }}>
                Esports-style strip (logo pane + white match row + teal map pane). Saves to the server; the overlay listens over Socket.IO. Tournament logo uploads here apply to WWCD overlays too{" "}
                <strong style={{ color: "#C8E8E4" }}>if shared</strong> — same <code style={{ color: "#F1CF69" }}>tournamentLogo</code> field.
              </p>
              <p style={{ margin: "0 0 14px", color: "#6f9aaf", fontSize: 11, fontFamily: "monospace" }}>
                OBS path: <code style={{ color: "#F1CF69" }}>/overlay/side-banner</code> · same origin as Admin (Dev <code style={{ color: "#F1CF69" }}>:5173</code> · prod build often{" "}
                <code style={{ color: "#F1CF69" }}>:3001</code>)
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 120, height: 88, borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "rgba(0,0,0,.35)", overflow: "hidden", display: "grid", placeItems: "center" }}>
                    {broadcastTournamentLogo ? (
                      <img alt="" src={broadcastTournamentLogo.startsWith("http") ? broadcastTournamentLogo : `${API}${broadcastTournamentLogo}`} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    ) : (
                      <span style={{ fontSize: 10, color: "#64748b" }}>No logo</span>
                    )}
                  </div>
                  <input ref={sideBannerTourLogoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    const fd = new FormData();
                    fd.append("logo", f);
                    const res = await fetch(`${API}/upload/tournament-logo`, { method: "POST", body: fd });
                    if (!res.ok) {
                      setMessage("Tournament logo upload failed.");
                      return;
                    }
                    const d = await res.json().catch(() => ({}));
                    setBroadcastTournamentLogo(d.tournamentLogo || null);
                    setMessage("Tournament logo updated.");
                  }} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button type="button" onClick={() => sideBannerTourLogoRef.current?.click()} style={{ padding: "8px 12px", borderRadius: 8, border: "none", fontWeight: 800, fontSize: 11, cursor: "pointer", background: "linear-gradient(90deg,#f7931e,#ff9f43)", color: "#1a1400" }}>
                      Upload tournament logo…
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await fetch(`${API}/settings`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ tournamentLogo: null }),
                        });
                        if (res.ok) {
                          setBroadcastTournamentLogo(null);
                          setMessage("Tournament logo cleared.");
                        }
                      }}
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,120,120,.4)", fontWeight: 700, fontSize: 11, cursor: "pointer", background: "rgba(220,38,38,.12)", color: "#fecaca" }}
                    >
                      Remove logo
                    </button>
                  </div>
                </div>

                <div style={{ flex: "1 1 320px", display: "grid", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#8899aa" }}>Group label</span>
                    <input
                      type="text"
                      value={sideOverlayDraft.groupLabel}
                      onChange={(e) => setSideOverlayDraft((d) => ({ ...d, groupLabel: e.target.value.slice(0, 40) }))}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.25)", color: "#fff", fontWeight: 700 }}
                    />
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                      <input type="checkbox" checked={Boolean(sideOverlayDraft.useLiveMatchNumber)} onChange={(e) => setSideOverlayDraft((d) => ({ ...d, useLiveMatchNumber: e.target.checked }))} /> Live match #
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#8899aa" }}>Match # (manual)</span>
                      <input
                        type="number"
                        min={1}
                        disabled={Boolean(sideOverlayDraft.useLiveMatchNumber)}
                        value={sideOverlayDraft.matchNumberManual || 1}
                        onChange={(e) =>
                          setSideOverlayDraft((d) => ({
                            ...d,
                            matchNumberManual: Math.max(1, Math.min(9999, parseInt(e.target.value, 10) || 1)),
                          }))
                        }
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,.12)",
                          background: sideOverlayDraft.useLiveMatchNumber ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.25)",
                          color: "#fff",
                          width: 100,
                        }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#8899aa" }}>MAP # (optional, top line suffix)</span>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        placeholder="—"
                        value={sideOverlayDraft.mapOrdinal == null ? "" : sideOverlayDraft.mapOrdinal}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v.trim() === "") setSideOverlayDraft((d) => ({ ...d, mapOrdinal: null }));
                          else {
                            const n = Math.min(999, Math.max(1, parseInt(v, 10) || 1));
                            setSideOverlayDraft((d) => ({ ...d, mapOrdinal: n }));
                          }
                        }}
                        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.25)", color: "#fff", width: 100 }}
                      />
                    </label>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                      <input type="checkbox" checked={Boolean(sideOverlayDraft.useLiveMapName)} onChange={(e) => setSideOverlayDraft((d) => ({ ...d, useLiveMapName: e.target.checked }))} /> Live map from match board ({bgmiMapLabel(currentMatch.map)})
                    </label>
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#8899aa" }}>Map display name override</span>
                    <input
                      type="text"
                      disabled={Boolean(sideOverlayDraft.useLiveMapName)}
                      value={sideOverlayDraft.mapNameManual || ""}
                      onChange={(e) => setSideOverlayDraft((d) => ({ ...d, mapNameManual: e.target.value.slice(0, 72) }))}
                      placeholder="RONDO …"
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,.12)",
                        background: sideOverlayDraft.useLiveMapName ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.25)",
                        color: "#fff",
                        fontWeight: 800,
                      }}
                    />
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 12 }}>
                    <input type="checkbox" checked={sideOverlayDraft.showSparkle !== false} onChange={(e) => setSideOverlayDraft((d) => ({ ...d, showSparkle: e.target.checked }))} /> Show sparkle on match row
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#8899aa" }}>Banner scale ({sideOverlayDraft.bannerScale})</span>
                    <input type="range" min={50} max={150} step={5} value={Math.round(Number(sideOverlayDraft.bannerScale) * 100) || 100} onChange={(e) => setSideOverlayDraft((d) => ({ ...d, bannerScale: Math.max(0.5, Math.min(1.5, Number(e.target.value) / 100)) }))} />
                  </label>
                </div>
              </div>

              <div style={{ fontWeight: 800, fontSize: 11, color: "#9aaabd", marginBottom: 10 }}>Colors</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                {[
                  { key: "logoPanelBg", label: "Logo panel" },
                  { key: "topBarBg", label: "Top row bg" },
                  { key: "topBarText", label: "Top row text" },
                  { key: "mapAreaBgStart", label: "Map gradient A" },
                  { key: "mapAreaBgEnd", label: "Map gradient B" },
                  { key: "mapNameColor", label: "Map name" },
                  { key: "sparkleColor", label: "Sparkle" },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <input
                      type="color"
                      value={clampHexColor(sideOverlayDraft[key], SIDE_OVERLAY_DEFAULT_PREFS[key])}
                      onChange={(e) =>
                        setSideOverlayDraft((d) => ({
                          ...d,
                          [key]: clampHexColor(e.target.value, SIDE_OVERLAY_DEFAULT_PREFS[key]),
                        }))
                      }
                      style={{ width: 42, height: 32, border: "none", borderRadius: 8, cursor: "pointer", background: "transparent" }}
                    />
                    <span style={{ fontSize: 9, color: "#7a8799", fontWeight: 700 }}>{label}</span>
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (sideAutosaveTimerRef.current != null) {
                      window.clearTimeout(sideAutosaveTimerRef.current);
                      sideAutosaveTimerRef.current = null;
                    }
                    const res = await fetch(`${API}/settings`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sideOverlayPrefs: mergeSideOverlayPrefs(sideOverlayDraft) }),
                    });
                    if (res.ok) {
                      const s = await res.json().catch(() => ({}));
                      if (s.sideOverlayPrefs && typeof s.sideOverlayPrefs === "object") {
                        const merged = mergeSideOverlayPrefs(s.sideOverlayPrefs);
                        setSideOverlayDraft(merged);
                        sideLastCanonRef.current = stableCanonSidePrefs(merged);
                      } else {
                        sideLastCanonRef.current = stableCanonSidePrefs(mergeSideOverlayPrefs(sideOverlayDraft));
                      }
                      setMessage("Side banner settings saved.");
                    } else setMessage("Could not save side banner settings.");
                  }}
                  style={{ padding: "10px 18px", borderRadius: 10, border: "none", fontWeight: 800, cursor: "pointer", background: "linear-gradient(90deg,#ffb347,#ff8c42)", color: "#1a1400", fontSize: 12 }}
                >
                  Save side banner settings
                </button>
                <button
                  type="button"
                  onClick={() => setSideOverlayDraft(() => ({ ...SIDE_OVERLAY_DEFAULT_PREFS }))}
                  style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,.05)", color: "#9fbfcf", fontSize: 12 }}
                >
                  Reset form to defaults
                </button>
              </div>
            </div>

            {/* Broadcast engine — theme & design (admin-visible entry) */}
            <div
              style={{
                marginTop: 16,
                padding: "16px 18px",
                background: "linear-gradient(135deg, rgba(115,231,190,.08) 0%, rgba(56,189,248,.06) 100%)",
                borderRadius: 14,
                border: "1px solid rgba(115,231,190,.22)",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, color: "#73E7BE", marginBottom: 6, letterSpacing: 0.4 }}>Theme & Design</div>
              <p style={{ margin: "0 0 14px", color: "#8CB7BE", fontSize: 12, lineHeight: 1.55, maxWidth: 720 }}>
                Pick a <strong style={{ color: "#C8E8E4" }}>theme name</strong> and <strong style={{ color: "#C8E8E4" }}>design label</strong> with live links.
                Opens the catalog page (not the overlay itself). Use the cards for “theme × design” pairs or scroll the full lists.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => window.open("/overlay/engine-catalog", "_blank")}
                  style={{
                    padding: "10px 18px",
                    background: "linear-gradient(90deg, #0d9488, #14b8a6)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    letterSpacing: 0.3,
                  }}
                >
                  Open theme & design catalog
                </button>
                <button
                  type="button"
                  onClick={() => window.open("/overlay/broadcast-engine?engineTheme=br_esports_pro_v0&engineDesign=dsgn_pro_wave0_000&alive=rounded&anim=subtle", "_blank", "width=1920,height=1080")}
                  style={{
                    padding: "10px 18px",
                    background: "rgba(255,255,255,.06)",
                    color: "#C8E8E4",
                    border: "1px solid rgba(115,231,190,.35)",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Open sample broadcast engine overlay
                </button>
              </div>
            </div>

            {/* Trigger WWCD */}
            <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(255,215,0,.05)", borderRadius: 12, border: "1px solid rgba(255,215,0,.15)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#FFD700" }}>Trigger WWCD Animation</div>
                  <div style={{ color: "#8CB7BE", fontSize: 11, marginTop: 2 }}>Play Winner Winner Chicken Dinner on the WWCD overlay window</div>
                </div>
                <button
                  onClick={async () => {
                    await sendOverlayCommand({ type: "showChickenDinner" });
                    setMessage("WWCD animation triggered!");
                  }}
                  style={{ padding: "8px 18px", background: "linear-gradient(90deg, #FFD700, #FFA500)", color: "#000", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}
                >
                  🍗 Trigger WWCD
                </button>
              </div>
            </div>

            {/* Test Elimination */}
            <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(255,80,80,.05)", borderRadius: 12, border: "1px solid rgba(255,80,80,.15)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#FF8080" }}>Test Elimination Banner</div>
                  <div style={{ color: "#8CB7BE", fontSize: 11, marginTop: 2 }}>Send a test elimination to the elimination overlay window</div>
                </div>
                <button
                  onClick={() => sendOverlayCommand({ type: "testElimination", team: "TEST TEAM", rank: 14, finishes: 3, points: 8 })}
                  style={{ padding: "8px 18px", background: "linear-gradient(90deg, #c0392b, #e74c3c)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}
                >
                  Send Test Elimination
                </button>
              </div>
            </div>

            {/* WWCD Color Customization */}
            <div style={{ marginTop: 14, padding: "16px 18px", background: "rgba(255,215,0,.04)", borderRadius: 12, border: "1px solid rgba(255,215,0,.15)" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#FFD700", marginBottom: 12, letterSpacing: 1 }}>WWCD Animation Colors</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
                {[
                  { key: "primary", label: "Primary", fallback: "#ff4655" },
                  { key: "gold", label: "Gold / Title", fallback: "#FFD700" },
                  { key: "accent", label: "Accent", fallback: "#ff4655" },
                ].map(({ key, label, fallback }) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="color"
                      value={wwcdColors[key] || fallback}
                      onChange={(e) => setWwcdColors((prev) => ({ ...prev, [key]: e.target.value }))}
                      style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", background: "transparent" }}
                    />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#ECF8FB", letterSpacing: 0.5 }}>{label}</div>
                      <div style={{ fontSize: 10, color: "#8CB7BE", fontFamily: "monospace" }}>{wwcdColors[key] || fallback}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={async () => {
                    await fetch(`${API}/overlay/wwcd-colors`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wwcdColors) });
                    setMessage("WWCD colors applied!");
                  }}
                  style={{ padding: "8px 18px", background: "linear-gradient(90deg, #FFD700, #FFA500)", color: "#000", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}
                >
                  Apply WWCD Colors
                </button>
                <button
                  onClick={async () => {
                    const reset = { primary: "", gold: "", accent: "", bg: "" };
                    setWwcdColors(reset);
                    await fetch(`${API}/overlay/wwcd-colors`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reset) });
                    setMessage("WWCD colors reset to theme default!");
                  }}
                  style={{ padding: "8px 18px", background: "rgba(255,255,255,.06)", color: "#8CB7BE", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Reset to Theme Default
                </button>
              </div>
            </div>

            {/* WWCD character card art (4 slots) */}
            <div style={{ marginTop: 14, padding: "16px 18px", background: "rgba(127,180,255,.05)", borderRadius: 12, border: "1px solid rgba(127,180,255,.2)" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#9EC9FF", marginBottom: 8, letterSpacing: 0.5 }}>WWCD character cards</div>
              <p style={{ margin: "0 0 14px", fontSize: 11, color: "#8CB7BE", lineHeight: 1.45 }}>
                Four images for the WWCD team stats overlay (slots match P1–P4 left to right). Upload PNG/WebP here, paste a public <strong style={{ color: "#ccc" }}>image URL</strong> for a browser-loaded asset, or remove to use the default art in{" "}
                <code style={{ color: "#F1CF69" }}>client/public/wwcd/</code>. Saved with app settings. Quick edit on the overlay:{" "}
                <code style={{ color: "#F1CF69" }}>/overlay/wwcd?edit=1</code> (use clean URL in OBSlive).
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
                {[0, 1, 2, 3].map((slot) => {
                  const art = wwcdCharacterArts[slot];
                  const src =
                    art && /^https?:\/\//i.test(art)
                      ? art
                      : art && art.startsWith("/")
                        ? `${API}${art}`
                        : `/wwcd/char-${slot}.png`;
                  return (
                    <div
                      key={slot}
                      style={{
                        borderRadius: 10,
                        border: wwcdSlotSelected === slot ? "2px solid #7EB8FF" : "1px solid rgba(255,255,255,.12)",
                        overflow: "hidden",
                        background: "rgba(0,0,0,.25)",
                      }}
                    >
                      <div style={{ height: 100, display: "grid", placeItems: "center", background: "rgba(255,255,255,.06)" }}>
                        <img src={src} alt="" style={{ maxHeight: 96, maxWidth: "100%", objectFit: "contain" }} />
                      </div>
                      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9EC9FF", textAlign: "center" }}>P{slot + 1}</div>
                        <button
                          type="button"
                          onClick={() => setWwcdSlotSelected(slot)}
                          style={{
                            padding: "6px 8px",
                            fontSize: 10,
                            fontWeight: 800,
                            borderRadius: 6,
                            border: "1px solid rgba(127,180,255,.4)",
                            background: wwcdSlotSelected === slot ? "rgba(127,180,255,.2)" : "rgba(255,255,255,.05)",
                            color: "#C8E0FF",
                            cursor: "pointer",
                          }}
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <input ref={wwcdFileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const fd = new FormData();
                fd.append("file", f);
                const res = await fetch(`${API}/upload/wwcd-character/${wwcdSlotSelected}`, { method: "POST", body: fd });
                if (res.ok) {
                  const data = await res.json().catch(() => ({}));
                  if (Array.isArray(data.wwcdCharacterArts)) setWwcdCharacterArts(normalizeWwcdArts(data.wwcdCharacterArts));
                  setMessage(`WWCD slot ${wwcdSlotSelected + 1} image saved.`);
                } else setMessage("WWCD upload failed.");
              }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#8CB7BE", fontWeight: 700 }}>Editing slot {wwcdSlotSelected + 1}:</span>
                <button
                  type="button"
                  onClick={() => wwcdFileInputRef.current?.click()}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(90deg, #7EB8FF, #5b8cff)", color: "#0a1628", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                >
                  Upload image…
                </button>
                <input
                  type="url"
                  value={wwcdUrlDraft}
                  onChange={(e) => setWwcdUrlDraft(e.target.value)}
                  placeholder="Image URL (https://…)"
                  style={{
                    flex: "1 1 200px",
                    minWidth: 160,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,.15)",
                    background: "rgba(0,0,0,.2)",
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`${API}/overlay/wwcd-characters`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ slot: wwcdSlotSelected, imageUrl: wwcdUrlDraft.trim() || null }),
                    });
                    if (res.ok) {
                      const data = await res.json().catch(() => ({}));
                      if (Array.isArray(data.wwcdCharacterArts)) setWwcdCharacterArts(normalizeWwcdArts(data.wwcdCharacterArts));
                      setMessage(`WWCD slot ${wwcdSlotSelected + 1} URL applied.`);
                    } else setMessage("Invalid URL or missing API.");
                  }}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(115,231,190,.45)", background: "rgba(56,189,248,.1)", color: "#73E7BE", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                >
                  Apply URL
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`${API}/overlay/wwcd-characters`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ slot: wwcdSlotSelected, imageUrl: null }),
                    });
                    if (res.ok) {
                      const data = await res.json().catch(() => ({}));
                      if (Array.isArray(data.wwcdCharacterArts)) setWwcdCharacterArts(normalizeWwcdArts(data.wwcdCharacterArts));
                      setWwcdUrlDraft("");
                      setMessage(`WWCD slot ${wwcdSlotSelected + 1} reset to default art.`);
                    }
                  }}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,120,120,.35)", background: "rgba(180,60,60,.15)", color: "#ffb0b0", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                >
                  Remove image
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,255,255,.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,.06)" }}>
              <p style={{ margin: "0 0 8px", color: "#8CB7BE", fontSize: 13, lineHeight: 1.6 }}>
                <strong style={{ color: "#73E7BE" }}>Backend required:</strong> Overlays need the API + Socket.IO server on port 3001. If anything is blank, confirm <code style={{ color: "#F1CF69" }}>node index.js</code> is running.
              </p>
              <p style={{ margin: "0 0 6px", color: "#8CB7BE", fontSize: 13, lineHeight: 1.6 }}>
                <strong style={{ color: "#73E7BE" }}>Dev (Vite):</strong> Ranking <code style={{ color: "#F1CF69" }}>http://localhost:5173/overlay/themed</code> (add{" "}
                <code style={{ color: "#F1CF69" }}>?alive=battery</code>, <code style={{ color: "#F1CF69" }}>heart</code>, <code style={{ color: "#F1CF69" }}>box</code>, …) · Broadcast engine{" "}
                <code style={{ color: "#F1CF69" }}>http://localhost:5173/overlay/broadcast-engine</code> · Elimination{" "}
                <code style={{ color: "#F1CF69" }}>http://localhost:5173/overlay/elimination</code> · WWCD{" "}
                <code style={{ color: "#F1CF69" }}>http://localhost:5173/overlay/wwcd</code> · WWCD strip only (transparent OBS){" "}
                <code style={{ color: "#F1CF69" }}>http://localhost:5173/overlay/wwcd-only</code> · Side banner{" "}
                <code style={{ color: "#F1CF69" }}>http://localhost:5173/overlay/side-banner</code> · legacy paths{" "}
                <code style={{ color: "#F1CF69" }}>/overlay/wwcd-4-teams</code>, <code style={{ color: "#F1CF69" }}>/overlay/wwcd-four</code> (
                <code style={{ color: "#F1CF69" }}>?theme=premiumGold</code>, <code style={{ color: "#F1CF69" }}>?position=bottom</code>, <code style={{ color: "#F1CF69" }}>?debug=1</code>)
              </p>
              <p style={{ margin: 0, color: "#8CB7BE", fontSize: 13, lineHeight: 1.6 }}>
                <strong style={{ color: "#73E7BE" }}>Single port:</strong> Run <code style={{ color: "#F1CF69" }}>npm run start:app</code> from the repo root (builds client + serves UI on 3001). Then swap <code style={{ color: "#F1CF69" }}>5173</code> for{" "}
                <code style={{ color: "#F1CF69" }}>3001</code> in OBS URLs (e.g. <code style={{ color: "#F1CF69" }}>http://127.0.0.1:3001/overlay/broadcast-engine</code>).
              </p>
            </div>
          </section>
        )}

        {expandedSection === "obsTriplePng" ? (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>OBS BROWSER SOURCES</p>
                <h2 style={styles.cardTitle}>Shared PNG · triple overlay slot</h2>
              </div>
            </div>

            <p style={{ margin: "0 0 14px", color: "#8CB7BE", fontSize: 13, lineHeight: 1.55, maxWidth: 960 }}>
              Upload one <strong style={{ color: "#C8E8E4" }}>PNG</strong> under{" "}
              <code style={{ color: "#F1CF69" }}>/uploads/obs-shared-triple/</code> — shared by all three OBS routes. Row data is{" "}
              <strong style={{ color: "#C8E8E4" }}>always</strong> the same live roster as Dashboard → Live rankings (Socket + REST). Choose a{" "}
              <strong style={{ color: "#C8E8E4" }}>column layout</strong> below to match your PNG: either the{" "}
              <strong style={{ color: "#C8E8E4" }}>dashboard</strong> shape (FIN + TOTAL + four squad pings) or the{" "}
              <strong style={{ color: "#C8E8E4" }}>gold strip</strong> (<strong>#</strong> · <strong>TEAM</strong> · one <strong>FP</strong> number ·{" "}
              <strong>STATUS</strong>). We don&apos;t auto-detect headings from PNG pixels. Optional URL tweaks: layout{" "}
              <code style={{ color: "#F1CF69" }}>?columns=gold4|live5</code>, FP source <code style={{ color: "#F1CF69" }}>?fp=pts|kills</code>, framing{" "}
              <code style={{ color: "#F1CF69" }}>?top=13&amp;left=44&amp;w=56&amp;h=78&amp;cap=18&amp;theme=dark&amp;debug=1</code>.
            </p>

            <div
              style={{
                marginBottom: 18,
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid rgba(56,189,248,.38)",
                background: "rgba(56,189,248,.06)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                    cursor: "pointer",
                    ...ns.matchBtnPrimary,
                    padding: "10px 18px",
                    fontSize: 13,
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  <span style={{ pointerEvents: "none", userSelect: "none" }}>📁 Choose PNG file…</span>
                  <input
                    type="file"
                    accept=".png,.PNG,image/png"
                    aria-label="Upload PNG for OBS triple slot"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0,
                      cursor: "pointer",
                      fontSize: 0,
                    }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      const name = String(file.name || "").toLowerCase();
                      const mime = typeof file.type === "string" ? file.type.toLowerCase().trim() : "";
                      if (!name.endsWith(".png")) {
                        setMessage(
                          mime === "image/png"
                            ? "PNG detected, but the filename must end with .png — rename it (for example overlay.png), then upload again."
                            : "Please choose a file whose name ends with .png.",
                        );
                        return;
                      }
                      const fd = new FormData();
                      fd.append("file", file);
                      try {
                        const res = await fetch(`${API}/upload/obs-shared-triple`, { method: "POST", body: fd });
                        const raw = await res.text();
                        let j = {};
                        if (raw) {
                          try {
                            j = JSON.parse(raw);
                          } catch {
                            /* non-JSON (e.g. Express HTML 404 body) */
                          }
                        }
                        if (!res.ok) {
                          if (res.status === 404) {
                            setMessage(
                              `OBS PNG upload route missing (404). Restart the backend from repo root so port 3001 runs current code (\`npm run dev\`, \`npm run dev:api\`, or \`node scripts/start-backend.js\`). Then try again.`,
                            );
                            return;
                          }
                          setMessage(
                            String(
                              j?.message ||
                                (raw.length > 0 && raw.length < 480
                                  ? raw.replace(/\s+/g, " ").trim()
                                  : `Upload failed (${res.status})`),
                            ),
                          );
                          return;
                        }
                        if (j.path) setObsSharedTriplePng(j.path);
                        setMessage("OBS shared PNG uploaded — refresh OBS browser sources if they still show the previous image.");
                      } catch {
                        setMessage(
                          `OBS PNG upload failed — could not reach the API. Keep Node on port 3001 (${API}); from repo root use \`npm run dev\` (starts API + Vite) or \`npm run dev:api\` plus \`npm run dev:vite\`.`,
                        );
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  style={{ ...ns.matchBtn, padding: "10px 18px", fontSize: 13 }}
                  onClick={async () => {
                    if (!obsSharedTriplePng) return;
                    if (!window.confirm("Remove OBS shared PNG? All three browser sources will show empty until you upload again.")) return;
                    try {
                      const res = await fetch(`${API}/settings`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ obsSharedTriplePng: null }),
                      });
                      if (res.ok) {
                        setObsSharedTriplePng(null);
                        setMessage("OBS shared PNG cleared.");
                      } else setMessage("Could not clear PNG (settings).");
                    } catch {
                      setMessage("Clear failed.");
                    }
                  }}
                >
                  Clear assignment
                </button>
              </div>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
                Use <strong style={{ color: "#cbd5e1" }}>Choose PNG file…</strong> — the OS picker opens from the whole green button (some browsers block hidden file inputs otherwise).
              </p>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
                <strong style={{ color: "#73E7BE" }}>Dev workflow:</strong> From repo root run <code style={{ color: "#F1CF69" }}>npm run dev</code> — it starts
                the API on 3001 and Vite on 5173 together. OBS URLs below use <code style={{ color: "#F1CF69" }}>127.0.0.1</code> instead of{" "}
                <code style={{ color: "#F1CF69" }}>localhost</code> on your machine so Windows often avoids IPv6 with nothing listening (fixes Preview/OBS
                “connection refused”). If uploads fail or never save, restart the backend (
                <code style={{ color: "#F1CF69" }}>npm run dev:api</code> or <code style={{ color: "#F1CF69" }}>node scripts/start-backend.js</code>)
                — an old Node process may lack <code style={{ color: "#F1CF69" }}>/upload/obs-shared-triple</code>.
              </p>
              {obsSharedTriplePng ? (
                <p style={{ margin: 0, fontSize: 12, color: "#6FF3CB", fontFamily: "ui-monospace,monospace", wordBreak: "break-all" }}>
                  Stored: <strong>{obsSharedTriplePng}</strong>
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: "#8CB7BE" }}>No file assigned yet.</p>
              )}
            </div>

            <div
              style={{
                marginBottom: 16,
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,.32)",
                background: "rgba(15,23,42,.38)",
              }}
            >
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                Match your PNG template (headings aren&apos;t read automatically). Rows still track all teams live from Dashboard → Live rankings.
              </p>
              <label style={{ display: "block", fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Column layout</label>
              <select
                value={obsSharedTripleColumns}
                style={{
                  width: "100%",
                  maxWidth: 480,
                  padding: "10px 12px",
                  marginBottom: 12,
                  borderRadius: 8,
                  background: "#0f172a",
                  color: "#e2e8f0",
                  border: "1px solid rgba(148,163,184,.38)",
                  fontSize: 13,
                }}
                onChange={async (e) => {
                  const v = e.target.value === "gold4" ? "gold4" : "live5";
                  setObsSharedTripleColumns(v);
                  try {
                    const res = await fetch(`${API}/settings`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ obsSharedTripleColumns: v }),
                    });
                    if (!res.ok) throw new Error(String(res.status));
                    const d = await res.json().catch(() => ({}));
                    setObsSharedTripleColumns(String(d.obsSharedTripleColumns) === "gold4" ? "gold4" : "live5");
                    setMessage("OBS triple column layout saved.");
                  } catch {
                    setMessage("Could not save OBS layout — check API.");
                  }
                }}
              >
                <option value="live5">Dashboard · RANK · TEAM · FIN · TOTAL · ALIVE (4 pings)</option>
                <option value="gold4">Gold strip · # · TEAM · FP (one number) · STATUS</option>
              </select>
              {obsSharedTripleColumns === "gold4" ? (
                <>
                  <label style={{ display: "block", fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>FP number shows</label>
                  <select
                    value={obsTripleFpMetric}
                    style={{
                      width: "100%",
                      maxWidth: 480,
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#0f172a",
                      color: "#e2e8f0",
                      border: "1px solid rgba(148,163,184,.38)",
                      fontSize: 13,
                    }}
                    onChange={async (e) => {
                      const m = e.target.value === "finishes" ? "finishes" : "points";
                      setObsTripleFpMetric(m);
                      try {
                        const res = await fetch(`${API}/settings`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ obsTripleFpMetric: m }),
                        });
                        if (!res.ok) throw new Error(String(res.status));
                        const d = await res.json().catch(() => ({}));
                        setObsTripleFpMetric(String(d.obsTripleFpMetric) === "finishes" ? "finishes" : "points");
                        setMessage("OBS triple FP source saved.");
                      } catch {
                        setMessage("Could not save FP mapping — check API.");
                      }
                    }}
                  >
                    <option value="points">Dashboard PTS (total points)</option>
                    <option value="finishes">Dashboard KILLS / finishes</option>
                  </select>
                </>
              ) : null}
            </div>

            {(() => {
              const overlayOrigin =
                typeof window !== "undefined" ? getOverlayPageOrigin() || window.location.origin.replace(/\/$/, "") : "";
              const triple = [
                { id: "eliminations", title: "Eliminations board" },
                { id: "top-four", title: "Top 4 squad board" },
                { id: "live-ranking", title: "Live ranking board" },
              ];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    OBS URLs (same PNG on every line)
                  </p>
                  {triple.map(({ id, title }) => {
                    const url = `${overlayOrigin}/overlay/obs-slot/${id}`;
                    return (
                      <div
                        key={id}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,.28)",
                          background: "rgba(15,23,42,.42)",
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 12,
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#e2e8f0", marginBottom: 4 }}>{title}</div>
                          <code style={{ fontSize: 12, color: "#7dd3fc", wordBreak: "break-all", display: "block" }}>{url}</code>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button
                            type="button"
                            style={{ ...ns.matchBtn, padding: "8px 12px", fontSize: 12 }}
                            onClick={() => navigator.clipboard.writeText(url).then(() => setMessage(`Copied · ${title}`)).catch(() => {})}
                          >
                            Copy URL
                          </button>
                          <button
                            type="button"
                            style={{ ...ns.matchBtnPrimary, padding: "8px 12px", fontSize: 12 }}
                            onClick={() => window.open(url, "_blank", "noopener,noreferrer,width=960,height=540")}
                          >
                            Preview
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {obsSharedTriplePng ? (
              <div style={{ marginTop: 20 }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Assigned image preview
                </p>
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(34,211,238,.28)",
                    background: "repeating-conic-gradient(rgba(100,116,139,.08) 0% 25%,transparent 25% 50%)50% / 24px 24px",
                    maxHeight: 320,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <img
                    alt=""
                    src={`${API}${obsSharedTriplePng}?adminPreview=1`}
                    style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain", display: "block" }}
                  />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ── Tournament Overview ── */}
        {expandedSection === "tournament" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>OVERALL STANDINGS</p>
                <h2 style={styles.cardTitle}>Tournament Overview</h2>
              </div>
              <button onClick={fetchTournament} style={ns.matchBtn}>Refresh</button>
            </div>
            <div
              ref={overallBgSectionRef}
              id="overall-standings-bg-upload"
              style={{
                marginBottom: 20,
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid rgba(115,231,190,.28)",
                background: "linear-gradient(135deg, rgba(56,189,248,.08) 0%, rgba(115,231,190,.06) 100%)",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, color: "#73E7BE", marginBottom: 8, letterSpacing: 0.4 }}>
                Overall tournament · custom background PNG
              </div>
              <p style={{ margin: "0 0 12px", color: "#8CB7BE", fontSize: 12, lineHeight: 1.55, maxWidth: 720 }}>
                Upload a <strong style={{ color: "#C8E8E4" }}>1920×1080</strong> (or similar) image. Standings and stats draw on top in a glass panel — see the{" "}
                <strong style={{ color: "#C8E8E4" }}>preview below</strong> and in{" "}
                <button
                  type="button"
                  onClick={() => window.open("/overlay/themed/overall", "_blank", "width=1920,height=1080")}
                  style={{
                    padding: "2px 8px",
                    margin: "0 2px",
                    fontSize: 11,
                    fontWeight: 800,
                    borderRadius: 6,
                    border: "1px solid rgba(241,207,105,.5)",
                    background: "rgba(241,207,105,.12)",
                    color: "#F1CF69",
                    cursor: "pointer",
                    verticalAlign: "baseline",
                  }}
                >
                  Open overlay window
                </button>{" "}
                for OBS/browser. Add <code style={{ color: "#F1CF69" }}>?layout=theme</code> to that URL to hide the image and use the default table-only theme.
              </p>
              {overallBgUploadMsg ? (
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6FF3CB" }}>{overallBgUploadMsg}</p>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#ccc", cursor: "pointer" }}>
                  Choose PNG / JPG
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,.svg"
                    style={{ display: "block", marginTop: 6 }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch(`${API}/upload/overall-standings-bg`, { method: "POST", body: fd });
                        const raw = await res.text();
                        let json = {};
                        try {
                          json = raw ? JSON.parse(raw) : {};
                        } catch {
                        /* HTML error page etc. */
                        }
                        if (!res.ok) {
                          const stripped = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
                          const snippet = stripped.slice(0, 180);
                          let msg = json.message || snippet || `HTTP ${res.status}`;
                          if (res.status === 404 || /cannot post/i.test(raw)) {
                            msg = `${msg} — Restart the API (node index.js) on port 3001, or stop duplicate Node processes using that port.`;
                          }
                          setOverallBgUploadMsg(msg);
                          setTimeout(() => setOverallBgUploadMsg(""), 12_000);
                          return;
                        }
                        if (json.path) setOverallStandingsBg(json.path);
                        setOverallBgUploadMsg("Saved — refresh the overall overlay window.");
                        setTimeout(() => setOverallBgUploadMsg(""), 4000);
                      } catch (err) {
                        const net = err instanceof Error ? err.message : "";
                        const hint =
                          net && /fetch|network|failed|load/i.test(net)
                            ? " — Is node index.js running on 3001? (Dev: keep API running while using Vite.)"
                            : "";
                        setOverallBgUploadMsg(`Could not reach server${hint}`);
                        setTimeout(() => setOverallBgUploadMsg(""), 12_000);
                      }
                    }}
                  />
                </label>
                {overallStandingsBg ? (
                  <>
                    <img
                      src={`${API}${overallStandingsBg}?t=1`}
                      alt=""
                      style={{ maxHeight: 72, borderRadius: 8, border: "1px solid rgba(255,255,255,.15)" }}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`${API}/settings`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ overallStandingsBg: null }),
                        });
                        setOverallStandingsBg(null);
                        setOverallBgUploadMsg("Cleared — using default themed layout.");
                        setTimeout(() => setOverallBgUploadMsg(""), 4000);
                      }}
                      style={{
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 8,
                        border: "1px solid rgba(248,113,113,.45)",
                        background: "rgba(0,0,0,.2)",
                        color: "#fca5a5",
                        cursor: "pointer",
                      }}
                    >
                      Remove background
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                fontWeight: 700,
                color: overallStandingsBg ? "#73E7BE" : "#5a6d72",
                letterSpacing: 0.03,
              }}
            >
              {overallStandingsBg
                ? "Preview — standings on your background (same layout as the overlay window)."
                : "Standings table — enable a background above to see numbers composited on your image."}
            </p>
            <div
              style={
                overallStandingsBg
                  ? {
                      position: "relative",
                      borderRadius: 16,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,.12)",
                      backgroundColor: "#0a0c10",
                      backgroundImage: `url(${API}${overallStandingsBg}?t=2)`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                    }
                  : {}
              }
            >
              <div
                style={
                  overallStandingsBg
                    ? {
                        padding: 16,
                        background: "rgba(8,10,18,0.86)",
                        backdropFilter: "blur(10px)",
                      }
                    : {}
                }
              >
                <div style={ns.matchTable}>
                  <div style={{ ...ns.matchTableHead, gridTemplateColumns: "50px 1fr 80px 80px 80px 80px 80px" }}>
                    <div>#</div><div>Team</div><div>Matches</div><div>Kills</div><div>Pos Pts</div><div>WWCD</div><div>Total</div>
                  </div>
                  {tournamentStats.map((s, i) => (
                    <div key={i} style={{ ...ns.matchTableRow, gridTemplateColumns: "50px 1fr 80px 80px 80px 80px 80px" }}>
                      <div style={{ fontWeight: 900, fontSize: 18, color: i < 3 ? "#F1CF69" : "#ECF8FB" }}>{i + 1}</div>
                      <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                        {s.logo && <img src={`${API}${s.logo}`} alt="" style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover" }} />}
                        {s.team}
                      </div>
                      <div>{s.matchesPlayed}</div>
                      <div style={{ fontWeight: 800 }}>{s.totalKills}</div>
                      <div style={{ color: "#F1CF69" }}>{s.totalPositionPoints}</div>
                      <div style={{ color: "#FFD700" }}>{s.chickenDinners}</div>
                      <div style={{ fontWeight: 900, fontSize: 18, color: "#55efc4" }}>{s.totalPoints}</div>
                    </div>
                  ))}
                </div>
                {tournamentStats.length > 0 && (
                  <div style={ns.mvpBar}>
                    <div style={ns.mvpCard}>
                      <span style={{ color: "#F1CF69", fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>TOP FRAGGER</span>
                      <span style={{ fontWeight: 900, fontSize: 20 }}>
                        {[...tournamentStats].sort((a, b) => b.totalKills - a.totalKills)[0]?.team || "—"}
                      </span>
                      <span style={{ color: "#8CB7BE", fontSize: 13 }}>
                        {[...tournamentStats].sort((a, b) => b.totalKills - a.totalKills)[0]?.totalKills || 0} kills
                      </span>
                    </div>
                    <div style={ns.mvpCard}>
                      <span style={{ color: "#FFD700", fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>MOST WWCD</span>
                      <span style={{ fontWeight: 900, fontSize: 20 }}>
                        {[...tournamentStats].sort((a, b) => b.chickenDinners - a.chickenDinners)[0]?.team || "—"}
                      </span>
                      <span style={{ color: "#8CB7BE", fontSize: 13 }}>
                        {[...tournamentStats].sort((a, b) => b.chickenDinners - a.chickenDinners)[0]?.chickenDinners || 0} dinners
                      </span>
                    </div>
                    <div style={ns.mvpCard}>
                      <span style={{ color: "#55efc4", fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>LEADER</span>
                      <span style={{ fontWeight: 900, fontSize: 20 }}>{tournamentStats[0]?.team || "—"}</span>
                      <span style={{ color: "#8CB7BE", fontSize: 13 }}>{tournamentStats[0]?.totalPoints || 0} pts</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {expandedSection === "googleSync" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>GOOGLE CLOUD</p>
                <h2 style={styles.cardTitle}>Drive &amp; Forms sync</h2>
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "#8891a1", maxWidth: 720, lineHeight: 1.55 }}>
                  Create a <strong style={{ color: "#cbd5df" }}>service account</strong> in Google Cloud, enable{" "}
                  <strong style={{ color: "#cbd5df" }}>Google Drive API</strong> and <strong style={{ color: "#cbd5df" }}>Google Sheets API</strong>. Download the JSON key and set{" "}
                  <code style={{ color: "#F1CF69" }}>GOOGLE_APPLICATION_CREDENTIALS</code> in your <code style={{ color: "#F1CF69" }}>.env</code> (path to that file). Share your
                  target Drive folder and the Form responses spreadsheet with the <strong style={{ color: "#cbd5df" }}>service account email</strong> (Editor on folder, Viewer on sheet is enough for read).
                </p>
              </div>
            </div>
            {googleMeta.credentialsConfigured ? (
              <p style={{ fontSize: 12, color: "#43e97b", marginBottom: 12 }}>Credentials: {googleMeta.credentialsFile}</p>
            ) : (
              <p style={{ fontSize: 12, color: "#f87171", marginBottom: 12 }}>
                No service account detected — add GOOGLE_APPLICATION_CREDENTIALS and restart <code style={{ color: "#F1CF69" }}>node index.js</code>.
              </p>
            )}
            <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
              <label style={{ fontSize: 12, color: "#cfd5df" }}>
                Drive folder ID (or full folder URL)
                <input
                  style={{ ...styles.matchBannerInput, width: "100%", marginTop: 6, textTransform: "none", fontWeight: 600 }}
                  value={googleIntegration.driveFolderId ?? ""}
                  onChange={(e) => setGoogleIntegration((g) => ({ ...g, driveFolderId: e.target.value }))}
                  autoComplete="off"
                />
              </label>
              <label style={{ fontSize: 12, color: "#cfd5df" }}>
                Registration spreadsheet ID (Form → Sheets link, or full URL)
                <input
                  style={{ ...styles.matchBannerInput, width: "100%", marginTop: 6, textTransform: "none", fontWeight: 600 }}
                  value={googleIntegration.registrationSpreadsheetId ?? ""}
                  onChange={(e) => setGoogleIntegration((g) => ({ ...g, registrationSpreadsheetId: e.target.value }))}
                  autoComplete="off"
                />
              </label>
              <label style={{ fontSize: 12, color: "#cfd5df" }}>
                Sheet range (tab with form responses)
                <input
                  style={{ ...styles.matchBannerInput, width: "100%", marginTop: 6, textTransform: "none", fontWeight: 600 }}
                  value={googleIntegration.registrationRange ?? "Form Responses 1!A:Z"}
                  onChange={(e) => setGoogleIntegration((g) => ({ ...g, registrationRange: e.target.value }))}
                  autoComplete="off"
                />
              </label>
              <label style={{ fontSize: 12, color: "#cfd5df", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={Boolean(googleIntegration.enabled)}
                  onChange={(e) => setGoogleIntegration((g) => ({ ...g, enabled: e.target.checked }))}
                />
                Enable automatic polling (Sheets registrations + new images in folder)
              </label>
              <label style={{ fontSize: 12, color: "#cfd5df", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={googleIntegration.autoUpload !== false}
                  onChange={(e) => setGoogleIntegration((g) => ({ ...g, autoUpload: e.target.checked }))}
                />
                Auto-upload tournament JSON + CSV after live updates (debounced ~90s)
              </label>
              <label style={{ fontSize: 12, color: "#cfd5df" }}>
                Poll interval (seconds, 30–3600)
                <input
                  type="number"
                  min={30}
                  max={3600}
                  className="horus-hide-num-spin"
                  style={{ ...styles.matchBannerInput, width: 140, marginTop: 6, fontWeight: 700 }}
                  value={Math.round((googleIntegration.syncIntervalMs || 120000) / 1000)}
                  onChange={(e) =>
                    setGoogleIntegration((g) => ({
                      ...g,
                      syncIntervalMs: Math.max(30, Math.min(3600, Number(e.target.value) || 120)) * 1000,
                    }))
                  }
                />
              </label>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
              <button type="button" style={ns.matchBtnPrimary} onClick={() => void saveGoogleConfig()}>
                Save settings
              </button>
              <button type="button" style={ns.matchBtn} onClick={() => void runGoogleSyncNow()}>
                Sync forms &amp; folder now
              </button>
              <button type="button" style={ns.matchBtn} onClick={() => void runGoogleExportNow()}>
                Upload snapshot to Drive
              </button>
            </div>
            {googleIntegration.lastError ? (
              <p style={{ marginTop: 14, fontSize: 12, color: "#f87171", maxWidth: 720 }}>{googleIntegration.lastError}</p>
            ) : null}
            <p style={{ marginTop: 14, fontSize: 11, color: "#6b8490", lineHeight: 1.55, maxWidth: 720 }}>
              <strong style={{ color: "#9fb8bf" }}>Uploads:</strong> each export adds timestamped{" "}
              <code style={{ color: "#F1CF69" }}>tournament-snapshot-*.json</code> and <code style={{ color: "#F1CF69" }}>overall-standings-*.csv</code> (standings,
              match history, WWCD list, fragger &amp; MVP boards). <strong style={{ color: "#9fb8bf" }}>Images:</strong> add files named like{" "}
              <code style={{ color: "#F1CF69" }}>TEAMNAME.png</code> to match roster names. <strong style={{ color: "#9fb8bf" }}>Forms:</strong> include a{" "}
              <em>Team name</em> column and player columns (Player 1…4 / IGN1…). True real-time Drive push needs HTTPS webhooks — this server uses configurable polling.
            </p>
          </section>
        )}
      </div>
      </div>
    </div>
  );
}

// ── Existing sub-components ──

function Field({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color: accent }}>{value}</div>
    </div>
  );
}

function NumberStepField({ label, value, min = 0, max = 99999, onChange }) {
  const parseVal = () => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const clamp = (n) => {
    let x = Math.trunc(Number(n));
    if (!Number.isFinite(x)) x = 0;
    x = Math.max(min, x);
    x = Math.min(max, x);
    return x;
  };
  const bump = (delta) => {
    onChange(String(clamp(parseVal() + delta)));
  };

  return (
    <Field label={label}>
      <div style={styles.numberStepperWrap}>
        <input
          className="horus-hide-num-spin"
          type="number"
          min={min}
          max={max}
          inputMode="numeric"
          style={styles.numberStepperInput}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return onChange("");
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            onChange(String(clamp(n)));
          }}
          onBlur={() => {
            if (value === "") onChange(String(min));
          }}
        />
        <div style={styles.numberStepperArrowCol}>
          <button
            type="button"
            onClick={() => bump(1)}
            style={styles.numberStepArrowBtn}
            aria-label={`Increase ${label}`}
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => bump(-1)}
            style={{ ...styles.numberStepArrowBtn, ...styles.numberStepArrowBtnDown }}
            aria-label={`Decrease ${label}`}
          >
            ▼
          </button>
        </div>
      </div>
    </Field>
  );
}

function TeamRegisterSection({ teams, API, onMessage }) {
  const [regForm, setRegForm] = useState({ team: "", players: ["", "", "", ""] });
  const [regLogo, setRegLogo] = useState(null);
  const regLogoRef = useRef(null);
  const [selectedRegId, setSelectedRegId] = useState(null);
  const [viewingTeam, setViewingTeam] = useState(null);

  const updatePlayer = (idx, val) => {
    setRegForm((prev) => {
      const p = [...prev.players];
      p[idx] = val;
      return { ...prev, players: p };
    });
  };

  const selectTeamForEdit = (t) => {
    setSelectedRegId(t.id);
    setViewingTeam(null);
    setRegForm({
      team: t.team || "",
      players: t.players && t.players.length > 0
        ? [...t.players, ...Array(4).fill("")].slice(0, 4)
        : ["", "", "", ""],
    });
    setRegLogo(null);
    onMessage(`Selected ${t.team} — edit fields and click Register to update.`);
  };

  const clearSelection = () => {
    setSelectedRegId(null);
    setRegForm({ team: "", players: ["", "", "", ""] });
    setRegLogo(null);
  };

  const deleteRegTeam = async (id, name) => {
    if (!confirm(`Delete team ${name}? This cannot be undone.`)) return;
    const res = await fetch(`${API}/teams/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedRegId === id) clearSelection();
      if (viewingTeam?.id === id) setViewingTeam(null);
      onMessage(`${name} deleted.`);
    } else {
      onMessage("Delete failed.");
    }
  };

  const viewTeamDetails = (t) => {
    setViewingTeam(viewingTeam?.id === t.id ? null : t);
  };

  const submitRegistration = async () => {
    const teamName = regForm.team.trim().toUpperCase();
    if (!teamName) return onMessage("Team name is required.");
    const playerNames = regForm.players.filter((p) => p.trim());
    const res = await fetch(`${API}/teams/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: teamName, players: playerNames }),
    });
    const data = await res.json();
    if (res.ok) {
      const teamId = data.team?.id;
      if (regLogo && teamId) {
        const fd = new FormData();
        fd.append("logo", regLogo);
        await fetch(`${API}/teams/${teamId}/logo`, { method: "POST", body: fd });
      }
      onMessage(data.updated ? `Team ${teamName} updated!` : `Team ${teamName} registered!`);
      clearSelection();
    } else {
      onMessage(data.message || "Registration failed.");
    }
  };

  const onRegistrationEnterCapture = (e) => {
    if (e.key !== "Enter" || e.repeat) return;
    const el = e.target;
    if ((el?.tagName || "").toLowerCase() !== "input") return;
    if (String(el.type || "").toLowerCase() === "file") return;
    e.preventDefault();
    void submitRegistration();
  };

  return (
    <section style={ns.sectionCard}>
      <div style={ns.sectionHeader}>
        <div>
          <p style={styles.cardLabel}>TEAM ENTRY FORM</p>
          <h2 style={styles.cardTitle}>Team Registration</h2>
        </div>
        {selectedRegId && (
          <button type="button" onClick={clearSelection} style={{ ...ns.matchBtn, borderColor: "#5a7a82", color: "#8CB7BE" }}>
            Clear Selection
          </button>
        )}
      </div>
      <p style={{ color: "#8CB7BE", fontSize: 13, margin: "0 0 18px", lineHeight: 1.6 }}>
        Register teams with their names, logos, and player names. This data is used by the Screenshot AI for accurate matching.
      </p>

        <div style={ns.regGrid}>
          <form
            style={{ display: "contents" }}
            onSubmit={(e) => e.preventDefault()}
            onKeyDownCapture={onRegistrationEnterCapture}
          >
            <div style={ns.regLeft}>
          {selectedRegId && (
            <div style={{ marginBottom: 14, padding: "8px 12px", background: "rgba(65,232,184,.08)", border: "1px solid rgba(65,232,184,.2)", borderRadius: 10, color: "#6FF3CB", fontSize: 12, fontWeight: 700 }}>
              Editing: {regForm.team || "—"}
            </div>
          )}

          <Field label="Team Name">
            <input
              style={styles.input}
              value={regForm.team}
              onChange={(e) => setRegForm({ ...regForm, team: e.target.value.toUpperCase() })}
              placeholder="TEAM NAME"
            />
          </Field>

          <div style={{ marginTop: 14 }}>
            <span style={styles.fieldLabel}>PLAYER NAMES</span>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {regForm.players.map((p, i) => (
                <input
                  key={i}
                  style={styles.input}
                  value={p}
                  onChange={(e) => updatePlayer(i, e.target.value)}
                  placeholder={`Player ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <span style={styles.fieldLabel}>TEAM LOGO</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
              <div
                onClick={() => regLogoRef.current?.click()}
                style={{
                  ...ns.logoPreview,
                  width: 64,
                  height: 64,
                  cursor: "pointer",
                  ...(regLogo
                    ? { backgroundImage: `url(${URL.createObjectURL(regLogo)})`, backgroundSize: "cover", backgroundPosition: "center", color: "transparent" }
                    : selectedRegId && teams.find((t) => t.id === selectedRegId)?.logo
                      ? { backgroundImage: `url(${API}${teams.find((t) => t.id === selectedRegId).logo})`, backgroundSize: "cover", backgroundPosition: "center", color: "transparent" }
                      : {}
                  ),
                }}
              >
                {(regLogo || (selectedRegId && teams.find((t) => t.id === selectedRegId)?.logo)) ? "" : "+"}
              </div>
              <div>
                <button type="button" onClick={() => regLogoRef.current?.click()} style={ns.logoUploadBtn}>
                  {regLogo ? "Change Logo" : "Upload Logo"}
                </button>
                <p style={{ margin: "4px 0 0", color: "#5a7a82", fontSize: 11 }}>PNG, JPG, SVG</p>
              </div>
              <input type="file" ref={regLogoRef} style={{ display: "none" }} accept="image/*" onChange={(e) => { if (e.target.files[0]) setRegLogo(e.target.files[0]); }} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void submitRegistration()}
            style={{ ...ns.matchBtnPrimary, marginTop: 18, padding: "14px 24px", fontSize: 15 }}
          >
            {selectedRegId ? "Update Team" : "Register Team"}
          </button>
            </div>
          </form>

        <div style={ns.regRight}>
          <span style={styles.fieldLabel}>REGISTERED TEAMS ({teams.length})</span>
          <div style={{ marginTop: 10, display: "grid", gap: 6, maxHeight: 500, overflowY: "auto" }}>
            {teams.map((t) => {
              const isSelected = selectedRegId === t.id;
              const isViewing = viewingTeam?.id === t.id;
              return (
                <div key={t.id}>
                  <div
                    style={{
                      ...ns.regTeamCard,
                      ...(isSelected ? { border: "1px solid rgba(65,232,184,.35)", background: "rgba(65,232,184,.06)" } : {}),
                    }}
                  >
                    <div style={{ ...styles.teamLogo, width: 32, height: 32, fontSize: 10, borderRadius: 8, ...(t.logo ? { backgroundImage: `url(${API}${t.logo})`, backgroundSize: "cover", color: "transparent" } : {}) }}>
                      {t.logo ? "" : t.team.slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{t.team}</div>
                      <div style={{ color: "#5a7a82", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {(t.players && t.players.length > 0) ? t.players.join(", ") : "No players listed"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => viewTeamDetails(t)} style={ns.regActionBtn} title="View details">
                        {isViewing ? "Hide" : "View"}
                      </button>
                      <button onClick={() => selectTeamForEdit(t)} style={{ ...ns.regActionBtn, color: "#6FF3CB", borderColor: "rgba(65,232,184,.25)" }} title="Select to edit">
                        Select
                      </button>
                      <button onClick={() => deleteRegTeam(t.id, t.team)} style={{ ...ns.regActionBtn, color: "#FF8080", borderColor: "rgba(255,80,80,.25)" }} title="Delete team">
                        Delete
                      </button>
                    </div>
                  </div>

                  {isViewing && (
                    <div style={ns.regDetailCard}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                        <div style={{ ...styles.teamLogo, width: 52, height: 52, fontSize: 16, borderRadius: 12, ...(t.logo ? { backgroundImage: `url(${API}${t.logo})`, backgroundSize: "cover", color: "transparent" } : {}) }}>
                          {t.logo ? "" : t.team.slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 20, color: "#ECF8FB" }}>{t.team}</div>
                          <div style={{ fontSize: 11, color: "#5a7a82", marginTop: 2 }}>ID: {t.id} &bull; Status: <span style={{ color: t.status === "alive" ? "#6FF3CB" : t.status === "eliminated" ? "#FF8080" : "#F1CF69" }}>{t.status}</span></div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#75E6BF", letterSpacing: 1.5, marginBottom: 8 }}>PLAYERS</div>
                        {(t.players && t.players.length > 0) ? (
                          <div style={{ display: "grid", gap: 4 }}>
                            {t.players.map((p, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.04)" }}>
                                <div style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg, #1a3a42, #0d2028)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, color: "#75E6BF", flexShrink: 0 }}>
                                  {i + 1}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#ECF8FB" }}>{p}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: "#5a7a82", fontSize: 12, fontStyle: "italic" }}>No players registered</div>
                        )}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div style={ns.regStatBox}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#F1CF69" }}>{t.points ?? 0}</div>
                          <div style={{ fontSize: 9, color: "#5a7a82", fontWeight: 700, letterSpacing: 1 }}>POINTS</div>
                        </div>
                        <div style={ns.regStatBox}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#6FF3CB" }}>{t.finishes ?? 0}</div>
                          <div style={{ fontSize: 9, color: "#5a7a82", fontWeight: 700, letterSpacing: 1 }}>KILLS</div>
                        </div>
                        <div style={ns.regStatBox}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#8CB7BE" }}>{t.alivePlayers ?? 4}</div>
                          <div style={{ fontSize: 9, color: "#5a7a82", fontWeight: 700, letterSpacing: 1 }}>ALIVE</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Tournament admin dashboard chrome (sidebar + rails)
const dash = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#090b0e",
    color: "#e8eaed",
    fontFamily: "Inter, system-ui, Segoe UI, sans-serif",
    display: "flex",
    alignItems: "stretch",
    boxSizing: "border-box",
  },
  sidebar: {
    width: 268,
    flexShrink: 0,
    boxSizing: "border-box",
    minHeight: "100vh",
    background: "linear-gradient(185deg,#12151c 0%,#0d0f13 52%,#0a0c10 100%)",
    borderRight: "1px solid rgba(255,255,255,.06)",
    display: "flex",
    flexDirection: "column",
    padding: "22px 16px",
    gap: 6,
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    paddingBottom: 16,
    borderBottom: "1px solid rgba(255,255,255,.07)",
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: "linear-gradient(135deg,#e63946,#9d0210)",
    display: "grid",
    placeItems: "center",
    fontSize: 22,
    boxShadow: "0 10px 28px rgba(230,57,70,.35)",
    border: "1px solid rgba(255,140,140,.35)",
    flexShrink: 0,
    transform: "rotate(-6deg)",
  },
  brandText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  brandTitle: {
    margin: 0,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.4,
    color: "#f8f9fa",
    lineHeight: 1.25,
    textTransform: "uppercase",
  },
  brandSub: { margin: 0, fontSize: 10, fontWeight: 700, color: "#8b929e", letterSpacing: 0.6 },
  navGroupLab: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.6,
    color: "#5c6370",
    marginTop: 14,
    marginBottom: 6,
    paddingLeft: 4,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid transparent",
    borderRadius: 10,
    padding: "11px 12px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    background: "transparent",
    color: "#b9c0cc",
    textAlign: "left",
    transition: "background .15s, border-color .15s, color .15s",
  },
  navItemActive: {
    background: "linear-gradient(90deg, rgba(230,57,70,.28), rgba(230,57,70,.06))",
    borderColor: "rgba(230,57,70,.45)",
    color: "#ffffff",
    boxShadow: "inset 3px 0 0 #e63946",
  },
  navLiveBadge: {
    marginLeft: "auto",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 0.8,
    color: "#061208",
    background: "#e63946",
    padding: "3px 6px",
    borderRadius: 4,
  },
  sidebarGrow: { flex: 1 },
  endLiveBtn: {
    marginTop: 14,
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "none",
    fontWeight: 900,
    fontSize: 13,
    letterSpacing: 0.5,
    cursor: "pointer",
    color: "#fff",
    background: "linear-gradient(180deg, #e63946, #c1121f)",
    boxShadow: "0 10px 36px rgba(230,57,70,.38)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  mainShell: {
    flex: 1,
    minWidth: 0,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#0a0c10",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    padding: "14px 22px 14px 18px",
    borderBottom: "1px solid rgba(255,255,255,.06)",
    background: "#13161d",
    flexShrink: 0,
  },
  topbarMid: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 200,
    justifyContent: "center",
  },
  livePillSm: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
    color: "#05230c",
    background: "#43e97b",
    padding: "4px 10px",
    borderRadius: 6,
  },
  matchTitleTb: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    letterSpacing: 0.6,
    color: "#fff",
    textTransform: "uppercase",
  },
  screenReaderOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  matchNumInput: {
    width: 58,
    boxSizing: "border-box",
    padding: "8px 6px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.16)",
    background: "#0d0f14",
    color: "#fff",
    fontSize: 16,
    fontWeight: 900,
    textAlign: "center",
    outline: "none",
    MozAppearance: "textfield",
  },
  restartCountTopBtn: {
    boxSizing: "border-box",
    padding: "8px 14px",
    minHeight: 38,
    borderRadius: 8,
    border: "1px solid rgba(251,191,36,.5)",
    background: "linear-gradient(165deg,#b45309,#92400e)",
    color: "#fffbeb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1,
    textTransform: "uppercase",
    cursor: "pointer",
    outline: "none",
    flexShrink: 0,
    whiteSpace: "nowrap",
    boxShadow: "0 2px 12px rgba(180,83,9,.35)",
  },
  matchBannerInput: {
    flex: "1 1 140px",
    minWidth: 120,
    maxWidth: 360,
    boxSizing: "border-box",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.14)",
    background: "#0d0f14",
    color: "#fff",
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    outline: "none",
  },
  matchDotMid: { color: "#6b7380", fontWeight: 900, fontSize: 16, flexShrink: 0, userSelect: "none" },
  matchMapSel: {
    boxSizing: "border-box",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.14)",
    background: "#0d0f14",
    color: "#fff",
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    cursor: "pointer",
    outline: "none",
    flexShrink: 0,
    minWidth: 130,
  },
  matchMetaFieldInput: {
    boxSizing: "border-box",
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,.12)",
    background: "#13161d",
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    outline: "none",
  },
  matchMetaFieldSelect: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: 140,
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,.12)",
    background: "#13161d",
    color: "#fff",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    cursor: "pointer",
    outline: "none",
  },
  topbarRight: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" },
  tbBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.12)",
    background: "#1e222b",
    color: "#dfe3ea",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },
  bellBtn: {
    position: "relative",
    width: 40,
    height: 40,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.1)",
    background: "#1a1d24",
    color: "#c5cad3",
    fontSize: 18,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  },
  bellDot: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    background: "#e63946",
    color: "#fff",
    fontSize: 10,
    fontWeight: 900,
    display: "grid",
    placeItems: "center",
    padding: "0 4px",
    border: "2px solid #13161d",
  },
  userChip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 12px 6px 6px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.03)",
  },
  userDot: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: "linear-gradient(145deg,#3b82f6,#1d4ed8)",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 13,
    color: "#fff",
  },
  userMeta: { display: "flex", flexDirection: "column", gap: 2 },
  userName: { fontSize: 13, fontWeight: 900, color: "#fff" },
  userRole: { fontSize: 10, fontWeight: 700, color: "#8891a1", letterSpacing: 0.3 },
  messageStrip: {
    padding: "8px 22px",
    fontSize: 12,
    color: "#8896a8",
    borderBottom: "1px solid rgba(255,255,255,.04)",
    background: "#0f1116",
    flexShrink: 0,
  },
  scrollMain: {
    flex: 1,
    overflow: "auto",
    padding: "18px 22px 28px",
    boxSizing: "border-box",
  },
  dashGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)",
    gap: 20,
    alignItems: "start",
  },
  cardPanel: {
    background: "#12151c",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.06)",
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(0,0,0,.4)",
  },
  cardPanelHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "18px 20px 14px",
    borderBottom: "1px solid rgba(255,255,255,.05)",
  },
  liveHdrBadge: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
    color: "#072512",
    background: "#43e97b",
    padding: "4px 10px",
    borderRadius: 8,
    marginRight: 8,
  },
  rankingsHeadTitle: {
    margin: "4px 0 0",
    fontSize: 22,
    fontWeight: 900,
    color: "#fff",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  wwcdHdr: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.2,
    color: "#8891a1",
    textAlign: "right",
    marginRight: 8,
    minWidth: 90,
    gridColumn: "span 1",
  },
  rankTableHead: {
    display: "grid",
    gridTemplateColumns:
      "56px minmax(160px,1.3fr) 108px 64px 80px minmax(100px, 1fr) 128px",
    padding: "12px 18px",
    gap: 8,
    alignItems: "center",
    color: "#8891a1",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(255,255,255,.06)",
    background: "#161920",
  },
  rankRow: {
    display: "grid",
    gridTemplateColumns:
      "56px minmax(160px,1.3fr) 108px 64px 80px minmax(100px, 1fr) 128px",
    padding: "12px 18px",
    gap: 8,
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,.04)",
    fontSize: 14,
  },
  rankNum: { fontSize: 22, fontWeight: 900, color: "#fff" },
  aliveSlot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    fontWeight: 800,
    boxSizing: "border-box",
  },
  wwcdBarTrack: {
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,.08)",
    overflow: "hidden",
    flex: 1,
    minWidth: 52,
    maxWidth: 120,
  },
  wwcdBarFill: { height: "100%", borderRadius: 999, transition: "width .25s ease" },
  editRowBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid rgba(80,142,255,.35)",
    background: "linear-gradient(180deg,#2b4acb,#233d9e)",
    color: "#eaf0ff",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },
  iconBtnMuted: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.03)",
    color: "#9aa3b2",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 800,
  },
  addTeamFooterBtn: {
    display: "flex",
    justifyContent: "center",
    padding: "16px",
    borderTop: "1px solid rgba(255,255,255,.06)",
    background: "#14171f",
  },
  addTeamMainBtn: {
    padding: "12px 28px",
    borderRadius: 10,
    border: "2px dashed rgba(230,57,70,.55)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    fontSize: 13,
    letterSpacing: 0.5,
    cursor: "pointer",
  },
  sideStack: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    position: "sticky",
    top: 12,
  },
  sideCard: {
    background: "#12151c",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.06)",
    padding: 16,
    boxShadow: "0 14px 40px rgba(0,0,0,.28)",
  },
  sideCardTitle: {
    margin: "0 0 12px",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.4,
    color: "#8b929e",
    textTransform: "uppercase",
  },
  kvRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13, gap: 8 },
  kvKey: { color: "#8891a1", fontWeight: 700 },
  kvVal: { fontWeight: 800, color: "#fff", textAlign: "right" },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  quickBtn: (bg, fg = "#fff") => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 72,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.08)",
    background: bg,
    color: fg,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  }),
  feedList: {
    maxHeight: 160,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    fontSize: 12,
    color: "#b9c0cc",
  },
  feedListTall: {
    maxHeight: 360,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    fontSize: 12,
    color: "#b9c0cc",
  },
  feedRow: { display: "flex", alignItems: "center", gap: 10 },
  previewCard: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    border: "1px solid rgba(67,233,123,.25)",
    background: "rgba(67,233,123,.06)",
  },
  liveSignalsPage: {
    width: "100%",
    maxWidth: 940,
    margin: "0 auto",
    paddingBottom: 24,
    boxSizing: "border-box",
  },
  liveSignalsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))",
    gap: 20,
    alignItems: "start",
  },
  overlayFooter: {
    marginTop: 22,
    padding: "16px 20px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.06)",
    background: "#14171f",
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "center",
  },
  overlayUrlBox: {
    flex: "1 1 280px",
    minWidth: 0,
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  overlayUrlInput: {
    flex: 1,
    minWidth: 0,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.1)",
    background: "#0d0f14",
    color: "#cfd5df",
    fontSize: 12,
    outline: "none",
    fontFamily: "ui-monospace, monospace",
  },
  overlayCopyBtn: {
    padding: "10px 18px",
    borderRadius: 10,
    border: "none",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    background: "linear-gradient(180deg,#3b82f6,#2563eb)",
    color: "#fff",
    flexShrink: 0,
  },
  overlayStatusRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
};

// ══════════════════════════════════════════════
// EXISTING STYLES — preserved exactly as-is
// ══════════════════════════════════════════════

const styles = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, #103740 0%, #071116 50%, #040b10 100%)",
    color: "#ECF8FB",
    fontFamily: "Inter, system-ui, sans-serif",
    padding: 24,
  },
  container: {
    maxWidth: 1440,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  eyebrow: {
    color: "#6FF3CB",
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: 800,
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 42,
    lineHeight: 1,
    fontWeight: 900,
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#9EC1C7",
    fontSize: 15,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(110px, 1fr))",
    gap: 12,
  },
  statCard: {
    background: "linear-gradient(180deg, rgba(10,27,34,.95), rgba(8,21,26,.9))",
    border: "1px solid rgba(132, 214, 208, 0.12)",
    borderRadius: 18,
    padding: "14px 16px",
    minWidth: 110,
    boxShadow: "0 14px 34px rgba(0,0,0,.25)",
  },
  statLabel: {
    color: "#83AEB6",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statValue: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: 900,
    lineHeight: 1,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.55fr) minmax(360px, 0.9fr)",
    gap: 20,
    alignItems: "start",
  },
  tableCard: {
    background: "linear-gradient(180deg, rgba(7,22,27,.97), rgba(5,16,21,.96))",
    borderRadius: 24,
    border: "1px solid rgba(112, 210, 206, .12)",
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(0,0,0,.35)",
  },
  formCard: {
    background: "linear-gradient(180deg, rgba(7,22,27,.97), rgba(5,16,21,.96))",
    borderRadius: 24,
    border: "1px solid rgba(112, 210, 206, .12)",
    padding: 22,
    boxShadow: "0 24px 60px rgba(0,0,0,.35)",
    position: "sticky",
    top: 18,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "20px 20px 16px",
    borderBottom: "1px solid rgba(255,255,255,.05)",
  },
  cardHeaderAlt: {
    marginBottom: 16,
  },
  cardLabel: {
    margin: 0,
    color: "#75E6BF",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 2,
  },
  cardTitle: {
    margin: "8px 0 0",
    fontSize: 28,
    lineHeight: 1.05,
    fontWeight: 900,
  },
  badge: {
    border: "1px solid rgba(118, 230, 195, .2)",
    color: "#A4E8D0",
    background: "rgba(111, 243, 203, .08)",
    padding: "10px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "72px minmax(180px, 1fr) 150px 110px 100px 170px",
    padding: "14px 20px",
    color: "#7FAFB8",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    borderBottom: "1px solid rgba(255,255,255,.05)",
  },
  rowsWrap: {
    paddingBottom: 6,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "72px minmax(180px, 1fr) 150px 110px 100px 170px",
    alignItems: "center",
    padding: "14px 20px",
    borderBottom: "1px solid rgba(255,255,255,.04)",
  },
  rank: {
    fontSize: 28,
    fontWeight: 900,
  },
  teamCell: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  teamLogo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: "linear-gradient(135deg, #F1CF69, #8B681E)",
    color: "#081116",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 14,
    boxShadow: "0 10px 22px rgba(0,0,0,.22)",
    cursor: "pointer",
  },
  teamName: {
    fontSize: 18,
    fontWeight: 800,
  },
  teamSub: {
    marginTop: 4,
    color: "#7EACB3",
    fontSize: 12,
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 96,
    padding: "9px 12px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    background: "rgba(255,255,255,.03)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
  },
  valueCell: {
    fontSize: 24,
    fontWeight: 900,
  },
  actionWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  editBtn: {
    background: "#122F36",
    color: "#E9FBFD",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#244A53",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  deleteBtn: {
    background: "#3A1620",
    color: "#FFDCE2",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#6B2B3B",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  emptyState: {
    padding: 32,
    color: "#96BDC4",
    fontSize: 15,
  },
  formGrid: {
    display: "grid",
    gap: 16,
  },
  statusSegmentRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    width: "100%",
  },
  field: {
    display: "grid",
    gap: 8,
  },
  fieldLabel: {
    color: "#8CB7BE",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.3,
    fontWeight: 800,
  },
  input: {
    width: "100%",
    background: "linear-gradient(90deg, rgba(13,29,34,1), rgba(10,24,29,1))",
    color: "#F2FEFF",
    border: "1px solid #1E3A43",
    borderRadius: 14,
    padding: "14px 15px",
    fontSize: 15,
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  },
  overlayThemeSelect: {
    padding: "8px 12px",
    background: "#0d2228",
    color: "#ECF8FB",
    border: "1px solid rgba(129, 196, 209, 0.35)",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    outline: "none",
    cursor: "pointer",
    minWidth: 150,
    colorScheme: "dark",
  },
  numberStepperWrap: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    minHeight: 50,
    borderRadius: 14,
    border: "1px solid #1E3A43",
    overflow: "hidden",
    boxSizing: "border-box",
    background: "linear-gradient(90deg, rgba(13,29,34,1), rgba(10,24,29,1))",
  },
  numberStepperInput: {
    flex: 1,
    minWidth: 0,
    border: "none",
    borderRadius: 0,
    padding: "12px 10px 12px 14px",
    fontSize: 16,
    fontWeight: 700,
    color: "#F2FEFF",
    background: "transparent",
    outline: "none",
    boxSizing: "border-box",
  },
  numberStepperArrowCol: {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    width: 40,
    borderLeft: "1px solid #1E3A43",
    background: "rgba(6, 16, 20, 0.9)",
  },
  numberStepArrowBtn: {
    flex: 1,
    minHeight: 24,
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,.07)",
    background: "linear-gradient(180deg, rgba(26,58,67,.98), rgba(16,43,52,.96))",
    color: "#B8DCE4",
    cursor: "pointer",
    fontSize: 11,
    lineHeight: 1,
    padding: "2px 0 0",
    margin: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  numberStepArrowBtnDown: {
    borderBottom: "none",
    padding: "0 0 2px",
    background: "linear-gradient(180deg, rgba(18,48,56,.96), rgba(12,38,46,.98))",
    color: "#9ECCD6",
  },
  inlineFields: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  primaryBtn: {
    background: "linear-gradient(90deg, #41E8B8, #2ED7A7)",
    color: "#031014",
    border: "none",
    borderRadius: 14,
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(65,232,184,.18)",
  },
  secondaryBtn: {
    background: "linear-gradient(180deg, #143039, #10252C)",
    color: "#ECFBFD",
    border: "1px solid #244B55",
    borderRadius: 14,
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
  },
};

// ══════════════════════════════════════════════
// NEW STYLES — for added sections only
// ══════════════════════════════════════════════

const ns = {
  overlayHeaderBtn: {
    background: "linear-gradient(90deg, #41E8B8, #2ED7A7)",
    color: "#031014",
    border: "none",
    borderRadius: 14,
    padding: "14px 22px",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(65,232,184,.2)",
    letterSpacing: 0.5,
    whiteSpace: "nowrap",
  },
  logoSection: {
    padding: "16px 0",
    borderTop: "1px solid rgba(255,255,255,.06)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
  },
  logoPreview: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: "linear-gradient(135deg, #F1CF69, #8B681E)",
    color: "#081116",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 18,
    flexShrink: 0,
    boxShadow: "0 8px 20px rgba(0,0,0,.25)",
  },
  logoUploadBtn: {
    background: "linear-gradient(180deg, #143039, #10252C)",
    color: "#ECFBFD",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#244B55",
    borderRadius: 12,
    padding: "10px 18px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    width: "100%",
  },
  chickenBanner: {
    marginTop: 20,
    padding: "18px 24px",
    background: "linear-gradient(90deg, #FFD700, #FF8C00)",
    borderRadius: 18,
    textAlign: "center",
    fontSize: 22,
    fontWeight: 900,
    color: "#1a0a00",
    letterSpacing: 1,
    animation: "pulse 1s ease-in-out infinite alternate",
    boxShadow: "0 0 40px rgba(255,215,0,.3)",
  },
  chickenIcon: { fontSize: 28, margin: "0 12px" },
  matchBar: {
    marginTop: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    padding: "16px 22px",
    background: "linear-gradient(180deg, rgba(7,22,27,.97), rgba(5,16,21,.96))",
    borderRadius: 18,
    border: "1px solid rgba(112, 210, 206, .12)",
    boxShadow: "0 14px 34px rgba(0,0,0,.25)",
  },
  matchInfo: { display: "flex", alignItems: "center", gap: 14 },
  matchBadge: {
    background: "rgba(111, 243, 203, .12)",
    border: "1px solid rgba(118, 230, 195, .25)",
    color: "#A4E8D0",
    padding: "8px 16px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 1,
  },
  matchStatus: { fontWeight: 800, fontSize: 14, letterSpacing: 1 },
  matchActions: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  autoCalcLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#8CB7BE",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  checkbox: { accentColor: "#41E8B8", width: 16, height: 16 },
  matchBtn: {
    background: "linear-gradient(180deg, #143039, #10252C)",
    color: "#ECFBFD",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#244B55",
    borderRadius: 12,
    padding: "10px 16px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
  matchBtnPrimary: {
    background: "linear-gradient(90deg, #41E8B8, #2ED7A7)",
    color: "#031014",
    border: "none",
    borderRadius: 12,
    padding: "10px 16px",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(65,232,184,.15)",
  },
  tabs: {
    marginTop: 16,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  tab: {
    background: "rgba(255,255,255,.04)",
    color: "#8CB7BE",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 14,
    padding: "10px 18px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    transition: "all .15s",
  },
  tabActive: {
    background: "rgba(65,232,184,.12)",
    color: "#A4E8D0",
    borderColor: "rgba(65,232,184,.3)",
  },
  sectionCard: {
    marginTop: 16,
    background: "linear-gradient(180deg, rgba(7,22,27,.97), rgba(5,16,21,.96))",
    borderRadius: 24,
    border: "1px solid rgba(112, 210, 206, .12)",
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(0,0,0,.35)",
    padding: 22,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    flexWrap: "wrap",
    gap: 12,
  },
  knockGrid: { display: "grid", gap: 6 },
  knockRow: {
    display: "grid",
    gridTemplateColumns: "52px minmax(140px, 200px) 150px minmax(120px, 150px) 1fr",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,.02)",
    border: "1px solid rgba(255,255,255,.04)",
  },
  knockTeamNum: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 0,
  },
  knockTeamNumLabel: {
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1,
    color: "#6b8490",
    textTransform: "uppercase",
  },
  knockTeam: { display: "flex", alignItems: "center", gap: 10 },
  aliveBars: { display: "flex", alignItems: "center", gap: 4 },
  aliveBar: { width: 8, height: 28, borderRadius: 2 },
  knockFinishPts: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 0,
  },
  knockFinishPtsLabel: {
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1,
    color: "#6b8490",
    textTransform: "uppercase",
  },
  knockFinishPtsCtl: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 2,
    minWidth: 52,
    padding: "4px 6px",
    borderRadius: 10,
    background: "rgba(0,0,0,.25)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  knockFinishPtsValue: {
    textAlign: "center",
    fontWeight: 900,
    fontSize: 16,
    color: "#F1CF69",
    lineHeight: 1,
    padding: "2px 0",
    userSelect: "none",
  },
  knockFinishArrowBtn: {
    border: "none",
    margin: 0,
    padding: "2px 0",
    borderRadius: 6,
    background: "rgba(255,255,255,.06)",
    color: "#7ee8ff",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
    lineHeight: 1,
  },
  knockBtns: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  knockBtn: {
    background: "#122F36",
    color: "#E9FBFD",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#244A53",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    minWidth: 36,
    textAlign: "center",
  },
  knockBtnDanger: {
    background: "#3A1620",
    color: "#FF6B6B",
    borderColor: "#6B2B3B",
  },
  rankBadge: {
    background: "rgba(241,207,105,.15)",
    color: "#F1CF69",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  rondoKnockGrid: { display: "grid", gap: 10 },
  rondoKnockRow: {
    display: "grid",
    gridTemplateColumns: "minmax(148px, 1fr) minmax(148px, 200px) 150px minmax(116px, 132px) 1fr",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    borderRadius: 16,
    transition: "box-shadow .3s ease, opacity .25s ease, border-color .25s ease",
    background: "linear-gradient(150deg, rgba(12, 46, 64, .48), rgba(8, 14, 28, .78))",
    border: "1px solid rgba(34,211,238,.16)",
    boxShadow: "0 14px 44px rgba(0,0,0,.34), inset 0 1px 0 rgba(167,139,250,.08)",
  },
  rondoKnockRowBenched: {
    animation: "rondoAdminGlow 2.55s ease-in-out infinite",
    borderColor: "rgba(34,211,238,.42)",
    background: "linear-gradient(150deg, rgba(14,72,94,.42), rgba(10,12,34,.82))",
  },
  rondoKnockRowFinal: {
    opacity: 0.6,
    filter: "saturate(0.82)",
    borderColor: "rgba(100,110,124,.35)",
    boxShadow: "0 8px 24px rgba(0,0,0,.42)",
  },
  rondoTitleBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 12px",
    borderRadius: 999,
    background: "linear-gradient(92deg, rgba(34,211,238,.16), rgba(167,139,250,.14))",
    border: "1px solid rgba(34,211,238,.3)",
    color: "#7eebfb",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.16em",
  },
  rondoRecallBtn: {
    background: "linear-gradient(160deg, #0ea5e9 0%, #7c3aed 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 16px",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    letterSpacing: "0.06em",
    boxShadow: "0 14px 32px rgba(14,165,233,.38)",
    minHeight: 40,
    textAlign: "center",
  },
  rondoFinalBenchBtn: {
    background: "rgba(248,113,113,.09)",
    color: "#fecdd3",
    border: "1px solid rgba(248,113,113,.45)",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 800,
    fontSize: 11,
    cursor: "pointer",
  },
  rondoMicroTag: {
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(167,139,250,.92)",
    border: "1px solid rgba(167,139,250,.42)",
    borderRadius: 6,
    padding: "3px 6px",
    display: "inline-block",
    marginTop: 4,
    maxWidth: "100%",
  },
  matchTable: {
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,.06)",
  },
  matchTableHead: {
    display: "grid",
    gridTemplateColumns: "50px 1fr 80px 60px 60px 70px 70px",
    padding: "12px 16px",
    background: "rgba(255,255,255,.04)",
    color: "#7FAFB8",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  matchTableRow: {
    display: "grid",
    gridTemplateColumns: "50px 1fr 80px 60px 60px 70px 70px",
    padding: "10px 16px",
    alignItems: "center",
    borderTop: "1px solid rgba(255,255,255,.04)",
    fontSize: 13,
  },
  screenshotArea: { display: "grid", gap: 16 },
  dropZone: {
    border: "2px dashed rgba(112, 210, 206, .25)",
    borderRadius: 18,
    padding: 40,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    minHeight: 160,
    transition: "border-color .2s",
    background: "rgba(255,255,255,.02)",
  },
  screenshotImg: {
    maxWidth: "100%",
    maxHeight: 300,
    borderRadius: 12,
    objectFit: "contain",
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid rgba(255,255,255,.1)",
    borderTop: "3px solid #41E8B8",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto",
  },
  ocrResults: { padding: 16, background: "rgba(255,255,255,.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,.06)" },
  ocrTable: { borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,.06)" },
  ocrHead: {
    display: "grid",
    gridTemplateColumns: "60px 1fr 80px 80px",
    padding: "10px 12px",
    background: "rgba(255,255,255,.04)",
    color: "#7FAFB8",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  ocrRow: {
    display: "grid",
    gridTemplateColumns: "60px 1fr 80px 80px",
    gap: 6,
    padding: "6px 12px",
    borderTop: "1px solid rgba(255,255,255,.04)",
  },
  ocrInput: {
    background: "rgba(13,29,34,1)",
    color: "#F2FEFF",
    border: "1px solid #1E3A43",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  historyList: { display: "grid", gap: 10 },
  historyCard: {
    padding: 16,
    borderRadius: 14,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.06)",
  },
  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 8,
  },
  historyBadge: {
    background: "rgba(111, 243, 203, .1)",
    color: "#A4E8D0",
    padding: "5px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
  },
  winnerBadge: {
    marginLeft: 8,
    background: "rgba(255,215,0,.12)",
    color: "#FFD700",
    padding: "5px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
  },
  historyTeams: { display: "flex", flexWrap: "wrap", gap: 6 },
  historyTeamChip: {
    background: "rgba(255,255,255,.05)",
    padding: "4px 10px",
    borderRadius: 8,
    fontSize: 12,
    color: "#9EC1C7",
    fontWeight: 700,
  },
  overlayGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 12,
  },
  overlayCard: {
    padding: 22,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    cursor: "pointer",
    textAlign: "center",
    transition: "all .15s",
  },
  mvpBar: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 12,
  },
  mvpCard: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 18,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    textAlign: "center",
  },
  regGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
    alignItems: "start",
  },
  regLeft: {},
  regRight: {},
  regTeamCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.05)",
  },
  regActionBtn: {
    background: "rgba(255,255,255,.04)",
    color: "#8CB7BE",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: 0.3,
  },
  regDetailCard: {
    margin: "4px 0 6px",
    padding: 16,
    borderRadius: 12,
    background: "linear-gradient(180deg, rgba(14,34,40,.95), rgba(8,22,28,.95))",
    border: "1px solid rgba(65,232,184,.12)",
  },
  regStatBox: {
    textAlign: "center",
    padding: "8px 6px",
    borderRadius: 8,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.04)",
  },
};
