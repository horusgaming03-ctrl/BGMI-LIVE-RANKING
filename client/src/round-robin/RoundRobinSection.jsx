import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connectSocket, getApiBase, getOverlayPageOrigin, teamLogoUrl } from "../apiOrigin";
import { buildOverlayStreamRankingOrder } from "../teamDisplayOrder";
import KnockControlDesk from "../knock-control/KnockControlDesk";
import { knockControlStyles } from "../knock-control/knockControlStyles";
import { useKnockControlActions } from "../knock-control/useKnockControlActions";
import { normalizeRoundRobinKnockTeams } from "../knock-control/normalizeKnockTeams";
import RondoKnockMatrix from "../rondo/RondoKnockMatrix";

const API = getApiBase();
const socket = connectSocket();

const MAP_OPTS = [
  { value: "erangel", label: "ERANGEL" },
  { value: "miramar", label: "MIRAMAR" },
  { value: "rondo", label: "RONDO" },
];

const defaultForm = { team: "", status: "alive", finishes: 0, points: 0 };

const emptyState = {
  groups: [],
  matches: [],
  allowSameGroup: false,
  liveMatch: null,
  currentMatch: null,
  standings: [],
};

async function readError(res) {
  try {
    const data = await res.json();
    if (data?.error) return String(data.error);
    if (data?.message) return String(data.message);
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

function Field({ label, children }) {
  return (
    <label style={ui.fieldWrap}>
      <span style={ui.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function NumberStepField({ label, value, min = 0, max = 99999, onChange }) {
  return (
    <label style={ui.fieldWrap}>
      <span style={ui.fieldLabel}>{label}</span>
      <div style={ui.stepRow}>
        <button type="button" style={ui.stepBtn} onClick={() => onChange(Math.max(min, (Number(value) || 0) - 1))}>
          −
        </button>
        <input
          type="number"
          min={min}
          max={max}
          style={ui.stepInput}
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        />
        <button type="button" style={ui.stepBtn} onClick={() => onChange(Math.min(max, (Number(value) || 0) + 1))}>
          +
        </button>
      </div>
    </label>
  );
}

export default function RoundRobinSection() {
  const [rr, setRr] = useState(emptyState);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [group1Id, setGroup1Id] = useState("");
  const [group2Id, setGroup2Id] = useState("");
  const [map, setMap] = useState("erangel");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingLogo, setPendingLogo] = useState(null);
  const logoInputRef = useRef(null);
  const logoTargetRef = useRef(null);

  const overlayOrigin = useMemo(
    () => getOverlayPageOrigin() || (typeof window !== "undefined" ? window.location.origin : ""),
    [],
  );
  const overlayUrl = useMemo(() => `${overlayOrigin}/overlay/round-robin`, [overlayOrigin]);

  const isLive = String(rr.liveMatch?.status || "").toLowerCase() === "live";
  const liveMatch = rr.liveMatch;
  const currentMatch = rr.currentMatch;
  const isRondoLive = isLive && String(liveMatch?.map || "erangel").toLowerCase() === "rondo";
  const finishBadgesObsUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/overlay/rondo/finish-badges`
      : "/overlay/rondo/finish-badges";

  const applyPayload = useCallback((data) => {
    if (!data || typeof data !== "object") return;
    setRr({
      groups: Array.isArray(data.groups) ? data.groups : [],
      matches: Array.isArray(data.matches) ? data.matches : [],
      allowSameGroup: Boolean(data.allowSameGroup),
      liveMatch: data.liveMatch || null,
      currentMatch: data.currentMatch || null,
      standings: Array.isArray(data.standings) ? data.standings : [],
    });
    setSelectedGroupId((prev) => prev || data.groups?.[0]?.id || "");
    setGroup1Id((prev) => prev || data.groups?.[0]?.id || "");
    setGroup2Id((prev) => prev || data.groups?.[1]?.id || data.groups?.[0]?.id || "");
  }, []);

  const knockTeams = useMemo(() => normalizeRoundRobinKnockTeams(liveMatch), [liveMatch]);

  const knockActions = useKnockControlActions({
    source: "roundRobin",
    apiBase: API,
    liveMatchId: liveMatch?.id,
    autoCalculate: true,
    onMessage: setMessage,
    onRoundRobinPayload: (data) => {
      if (!data || typeof data !== "object") return;
      if (data.liveMatch != null || Array.isArray(data.groups)) applyPayload(data);
      else if (data.match) setRr((prev) => ({ ...prev, liveMatch: data.match }));
    },
  });

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const res = await fetch(`${API}/round-robin`);
        if (!cancelled && res.ok) applyPayload(await res.json());
      } catch {
        /* ignore */
      }
    }
    void boot();
    function onRr(payload) {
      applyPayload(payload);
    }
    function request() {
      socket.emit("requestRoundRobin");
    }
    socket.on("roundRobinUpdated", onRr);
    socket.on("connect", request);
    if (socket.connected) request();
    return () => {
      cancelled = true;
      socket.off("roundRobinUpdated", onRr);
      socket.off("connect", request);
    };
  }, [applyPayload]);

  const selectedGroup = useMemo(
    () => (rr.groups || []).find((g) => String(g.id) === String(selectedGroupId)) || null,
    [rr.groups, selectedGroupId],
  );

  const tableTeams = useMemo(() => {
    if (isLive && liveMatch?.teams) {
      return buildOverlayStreamRankingOrder(
        liveMatch.teams.map((t, i) => ({
          ...t,
          id: Number(t.teamId) || i,
          teamId: t.teamId,
          finishes: Number(t.finishes) || 0,
          points: Number(t.points) || 0,
          positionPoints: Number(t.positionPoints) || 0,
          alivePlayers: t.alivePlayers,
          status: t.status || "alive",
        })),
      );
    }
    const list = selectedGroup?.teams || [];
    return [...list].sort((a, b) => a.slot - b.slot);
  }, [isLive, liveMatch, selectedGroup]);

  const selectedTeam = useMemo(() => {
    if (selectedTeamId == null) return null;
    if (isLive) {
      return tableTeams.find((t) => String(t.teamId) === String(selectedTeamId)) || null;
    }
    return (selectedGroup?.teams || []).find((t) => String(t.id) === String(selectedTeamId)) || null;
  }, [selectedTeamId, tableTeams, isLive, selectedGroup]);

  async function api(path, options = {}) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}${path}`, {
        method: options.method || "POST",
        headers: options.headers || (options.body instanceof FormData ? undefined : { "Content-Type": "application/json" }),
        body:
          options.body instanceof FormData
            ? options.body
            : options.body != null
              ? JSON.stringify(options.body)
              : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.message || (await readError(res)));
        return null;
      }
      applyPayload(data);
      if (options.okMessage || data.message) setMessage(options.okMessage || data.message);
      return data;
    } catch (e) {
      setError(String(e?.message || e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(teamId, file) {
    const fd = new FormData();
    fd.append("logo", file);
    return api(`/round-robin/teams/${teamId}/logo`, { method: "POST", body: fd, okMessage: "Logo uploaded." });
  }

  function clearPendingLogo() {
    if (pendingLogo?.url) URL.revokeObjectURL(pendingLogo.url);
    setPendingLogo(null);
  }

  function triggerLogoPick(target) {
    logoTargetRef.current = target;
    logoInputRef.current?.click();
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const target = logoTargetRef.current;
    if (target === "new") {
      clearPendingLogo();
      setPendingLogo({ file, url: URL.createObjectURL(file) });
      setMessage("Logo ready — will upload after Add Team.");
      return;
    }
    if (target) {
      await uploadLogo(target, file);
    }
  }

  function selectTeam(team) {
    const id = isLive ? team.teamId : team.id;
    setSelectedTeamId(id);
    setForm({
      team: team.team || "",
      status: team.status || "alive",
      finishes: Number(team.finishes) || 0,
      points: Number(team.points) || 0,
    });
  }

  async function createTeam() {
    if (!selectedGroupId) {
      setError("Select a group first.");
      return;
    }
    const name = String(form.team || "").trim();
    if (!name) {
      setError("Enter a team name.");
      return;
    }
    const data = await api(`/round-robin/groups/${selectedGroupId}/teams`, {
      body: { team: name },
      okMessage: "Team added.",
    });
    if (!data) return;
    const created = data.team;
    if (pendingLogo?.file && created?.id) {
      await uploadLogo(created.id, pendingLogo.file);
      clearPendingLogo();
    }
    setForm(defaultForm);
    setSelectedTeamId(created?.id || null);
  }

  async function updateTeam() {
    if (!selectedTeamId) {
      setError("Select a team first.");
      return;
    }
    const teamId = selectedTeamId;
    await api(`/round-robin/teams/${teamId}`, {
      body: { team: form.team },
      okMessage: "Team name updated.",
    });

    if (isLive && liveMatch?.id) {
      await api(`/round-robin/matches/${liveMatch.id}/teams/${teamId}`, {
        body: {
          status: form.status,
          finishes: Number(form.finishes) || 0,
          points: Number(form.points) || 0,
        },
        okMessage: "Live scores updated.",
      });
    }
  }

  async function deleteTeam(id) {
    if (!window.confirm("Delete this Round Robin team?")) return;
    await api(`/round-robin/teams/${id}`, { method: "DELETE", okMessage: "Team deleted." });
    if (String(selectedTeamId) === String(id)) {
      setSelectedTeamId(null);
      setForm(defaultForm);
    }
  }

  return (
    <div style={ui.page}>
      <input
        type="file"
        ref={logoInputRef}
        style={{ display: "none" }}
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg"
        onChange={handleLogoChange}
      />

      <div style={ui.headerRow}>
        <div>
          <p style={ui.kicker}>TOURNAMENT MODE</p>
          <h2 style={ui.title}>Round Robin</h2>
          <p style={ui.hint}>
            Type your own group names and teams here. This is separate from Live Rankings — your normal match system is not changed.
          </p>
        </div>
        <div style={ui.headerActions}>
          <button type="button" style={ui.btnPrimary} onClick={() => window.open(overlayUrl, "_blank", "width=1920,height=1080")}>
            Open RR overlay
          </button>
          <button type="button" style={ui.btn} onClick={() => void navigator.clipboard?.writeText(overlayUrl)}>
            Copy overlay URL
          </button>
        </div>
      </div>

      <div style={ui.urlBox}>
        <code style={ui.urlCode}>{overlayUrl}</code>
      </div>

      {(message || error) && <div style={{ ...ui.banner, color: error ? "#fecaca" : "#bbf7d0" }}>{error || message}</div>}

      <section style={ui.panel}>
        <h3 style={ui.panelTitle}>Groups</h3>
        <p style={ui.hint}>Enter each group name, then add 8–10 teams with name and logo in Live Rankings below.</p>
        <div style={ui.headerActions}>
          <button type="button" style={ui.btn} disabled={busy} onClick={() => api("/round-robin/groups", { okMessage: "Group added." })}>
            Add group
          </button>
        </div>
        <div style={ui.groupGrid}>
          {(rr.groups || []).map((group) => (
            <div key={group.id} style={ui.groupCard}>
              <input
                style={ui.groupNameInput}
                defaultValue={group.name}
                key={`${group.id}-${group.name}`}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== group.name) void api(`/round-robin/groups/${group.id}`, { body: { name } });
                }}
              />
              <p style={ui.groupMeta}>
                {(group.teams || []).length}/10 teams · slots {group.letter}1–{group.letter}
                {Math.max((group.teams || []).length, 1)}
              </p>
              <div style={ui.chipRow}>
                {(group.teams || []).map((t) => (
                  <span key={t.id} style={ui.chip}>
                    {t.logo ? <img alt="" src={teamLogoUrl(t.logo)} style={ui.chipLogo} /> : null}
                    {t.slotLabel || `${group.letter}${t.slot}`} {t.team}
                  </span>
                ))}
              </div>
              <button
                type="button"
                style={{ ...ui.btnTiny, marginTop: 8 }}
                onClick={() => {
                  setSelectedGroupId(group.id);
                  setMessage(`Selected ${group.name} for adding teams.`);
                }}
              >
                Select for teams
              </button>
              <button
                type="button"
                style={{ ...ui.btnDangerTiny, marginTop: 8, marginLeft: 6 }}
                disabled={busy}
                onClick={() => {
                  const matchCount = (rr.matches || []).filter(
                    (m) => String(m.group1Id) === String(group.id) || String(m.group2Id) === String(group.id),
                  ).length;
                  const extra =
                    matchCount > 0
                      ? `\n\nThis also removes ${matchCount} match record${matchCount === 1 ? "" : "s"} for this group.`
                      : "";
                  if (
                    window.confirm(
                      `Delete ${group.name} and all ${(group.teams || []).length} team(s)?${extra}\n\nThis cannot be undone.`,
                    )
                  ) {
                    void api(`/round-robin/groups/${group.id}`, { method: "DELETE" });
                  }
                }}
              >
                Delete group
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={ui.panel}>
        <h3 style={ui.panelTitle}>Create match</h3>
        <div style={ui.matchGrid}>
          <label style={ui.fieldWrap}>
            <span style={ui.fieldLabel}>Group 1</span>
            <select style={ui.select} value={group1Id} onChange={(e) => setGroup1Id(e.target.value)}>
              {(rr.groups || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({(g.teams || []).length})
                </option>
              ))}
            </select>
          </label>
          <label style={ui.fieldWrap}>
            <span style={ui.fieldLabel}>Group 2</span>
            <select style={ui.select} value={group2Id} onChange={(e) => setGroup2Id(e.target.value)}>
              {(rr.groups || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({(g.teams || []).length})
                </option>
              ))}
            </select>
          </label>
          <label style={ui.fieldWrap}>
            <span style={ui.fieldLabel}>Map</span>
            <select style={ui.select} value={map} onChange={(e) => setMap(e.target.value)}>
              {MAP_OPTS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label style={ui.checkRow}>
          <input
            type="checkbox"
            checked={Boolean(rr.allowSameGroup)}
            onChange={(e) => api("/round-robin/settings", { body: { allowSameGroup: e.target.checked } })}
          />
          Allow same-group match
        </label>
        <div style={ui.headerActions}>
          <button
            type="button"
            style={ui.btnPrimary}
            disabled={busy}
            onClick={() => api("/round-robin/matches", { body: { group1Id, group2Id, map }, okMessage: "Match created." })}
          >
            Create match
          </button>
          {currentMatch && String(currentMatch.status) !== "completed" && (
            <>
              <button
                type="button"
                style={ui.btn}
                disabled={busy || String(currentMatch.status) === "live"}
                onClick={() => api(`/round-robin/matches/${currentMatch.id}/start`, { okMessage: "Match is LIVE." })}
              >
                Start match
              </button>
              <button
                type="button"
                style={ui.btnDanger}
                disabled={busy || String(currentMatch.status) !== "live"}
                onClick={() => {
                  if (window.confirm("End this Round Robin match?")) {
                    void api(`/round-robin/matches/${currentMatch.id}/end`, { okMessage: "Match completed." });
                  }
                }}
              >
                End match
              </button>
            </>
          )}
        </div>
        {currentMatch && (
          <p style={{ ...ui.hint, marginTop: 10 }}>
            {currentMatch.id} · {currentMatch.label} · {String(currentMatch.status).toUpperCase()} ·{" "}
            {currentMatch.teamCount || currentMatch.teams?.length || 0} teams
          </p>
        )}
      </section>

      {isLive ? (
        <section style={ui.panel}>
          <h3 style={ui.panelTitle}>{isRondoLive ? "Rondo Knock Matrix" : "Team Knock Control"}</h3>
          <p style={ui.hint}>
            {isRondoLive ? (
              <>
                Rondo recall / bench desk for this live Round Robin lobby — isolated from main Simple scoring (
                <code style={{ color: "#F1CF69" }}>/overlay/round-robin</code>).
              </>
            ) : (
              <>
                Same 1K / 2K / 3K / OUT process as Knock Control — updates this Round Robin match only (
                <code style={{ color: "#F1CF69" }}>/overlay/round-robin</code>).
              </>
            )}
          </p>
          {isRondoLive ? (
            <RondoKnockMatrix
              teams={knockTeams}
              apiBase={API}
              teamLogoStyle={{}}
              styles={{ teamLogo: ui.teamLogo }}
              ns={knockControlStyles}
              knockTeam={knockActions.knockTeam}
              setAlive={knockActions.setAlive}
              adjustTeamFinishes={knockActions.adjustTeamFinishes}
              triggerRondoRecall={knockActions.triggerRondoRecall}
              undoRondoMistakenBench={knockActions.undoRondoMistakenBench}
              finalizeBenchedElimination={knockActions.finalizeBenchedElimination}
              finishBadgesObsUrl={finishBadgesObsUrl}
              restoreEliminatedTeam={knockActions.restoreEliminatedTeam}
              matchScoresEditable
            />
          ) : (
            <KnockControlDesk
              teams={knockTeams}
              scoresEditable
              actions={knockActions}
              subtitle={null}
              emptyAliveMessage="No squads in this live lobby."
            />
          )}
        </section>
      ) : null}

      <div style={ui.dashGrid}>
        <section style={ui.cardPanel}>
          <div style={ui.cardPanelHead}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isLive ? <span style={ui.liveBadge}>LIVE</span> : null}
              <h2 style={ui.rankTitle}>Round Robin live rankings</h2>
            </div>
            <div style={ui.headerActions}>
              <button type="button" style={ui.editBtn} onClick={() => window.open(overlayUrl, "_blank", "width=1920,height=1080")}>
                Open overlay
              </button>
              <span style={ui.countBadge}>{tableTeams.length} teams</span>
            </div>
          </div>

          {!isLive && (
            <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <label style={ui.fieldWrap}>
                <span style={ui.fieldLabel}>Working group</span>
                <select style={ui.select} value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
                  {(rr.groups || []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({(g.teams || []).length} teams)
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div style={ui.rankTableHead}>
            <div>RANK</div>
            <div>TEAM</div>
            <div>GROUP</div>
            <div>ALIVE</div>
            <div>KILLS</div>
            <div>PTS</div>
            <div style={{ textAlign: "center" }}>ACTION</div>
          </div>

          <div>
            {tableTeams.length === 0 ? (
              <div style={ui.empty}>No teams yet. Use Live Control on the right to add teams to the selected group.</div>
            ) : (
              tableTeams.map((team, index) => {
                const tid = isLive ? team.teamId : team.id;
                const active = String(selectedTeamId) === String(tid);
                const aliveSlots =
                  team.status === "eliminated" ? 0 : Math.max(0, Math.min(4, Number(team.alivePlayers ?? 4)));
                return (
                  <div
                    key={tid}
                    style={{
                      ...ui.rankRow,
                      background: active
                        ? "linear-gradient(90deg, rgba(230,57,70,.14), rgba(18,21,28,.94))"
                        : index % 2 === 0
                          ? "rgba(255,255,255,.02)"
                          : "rgba(255,255,255,.035)",
                      borderLeft: active ? "3px solid #e63946" : "3px solid transparent",
                    }}
                  >
                    <div style={{ ...ui.rankNum, ...(active ? { color: "#e63946" } : {}) }}>{index + 1}</div>
                    <div style={ui.teamCell}>
                      <div
                        role="button"
                        tabIndex={0}
                        style={{
                          ...ui.teamLogo,
                          ...(team.logo
                            ? {
                                backgroundImage: `url(${teamLogoUrl(team.logo)})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                color: "transparent",
                              }
                            : {}),
                        }}
                        onClick={() => triggerLogoPick(tid)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") triggerLogoPick(tid);
                        }}
                        title="Upload logo"
                      >
                        {team.logo ? "" : String(team.team || "??").slice(0, 2)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={ui.teamName}>{team.team}</div>
                        <div style={ui.teamSub}>
                          {(team.slotLabel || "") + (team.status ? ` · ${String(team.status).toUpperCase()}` : "")}
                          {team.positionPoints > 0 ? ` · +${team.positionPoints} pos` : ""}
                        </div>
                      </div>
                    </div>
                    <div style={ui.teamSub}>{team.groupName || selectedGroup?.name || "—"}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          style={{
                            ...ui.aliveSlot,
                            background:
                              i < aliveSlots ? "rgba(92,255,114,.18)" : aliveSlots > 0 ? "rgba(230,57,70,.22)" : "rgba(255,255,255,.04)",
                            color: i < aliveSlots ? "#5cff72" : aliveSlots > 0 ? "#e63946" : "#5c6370",
                          }}
                        >
                          👤
                        </div>
                      ))}
                    </div>
                    <div style={ui.valueCell}>{team.finishes ?? 0}</div>
                    <div style={ui.valueCell}>{team.points ?? 0}</div>
                    <div style={ui.actionWrap}>
                      <button type="button" style={ui.editBtn} onClick={() => selectTeam(team)}>
                        ✎ Edit
                      </button>
                      {!isLive && (
                        <button type="button" style={ui.iconBtn} onClick={() => deleteTeam(tid)}>
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!isLive && (
            <div style={ui.addFooter}>
              <button type="button" style={ui.addMainBtn} onClick={createTeam} disabled={busy}>
                + Add team
              </button>
            </div>
          )}
        </section>

        <aside style={ui.formCard}>
          <div style={ui.formHead}>
            <p style={ui.kicker}>LIVE CONTROL</p>
            <h2 style={ui.formTitle}>Create / Update Team</h2>
          </div>

          {!isLive && (
            <label style={ui.fieldWrap}>
              <span style={ui.fieldLabel}>Group</span>
              <select style={ui.select} value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
                {(rr.groups || []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <Field label="Team name">
            <input
              style={ui.input}
              value={form.team}
              onChange={(e) => setForm({ ...form, team: e.target.value.toUpperCase() })}
              placeholder="ENTER TEAM NAME"
            />
          </Field>

          {isLive && (
            <Field label="Status">
              <div style={ui.statusRow}>
                {[
                  { id: "alive", label: "Alive", bg: "linear-gradient(180deg, #5CFF72, #3ad65a)" },
                  { id: "knocked", label: "Knocked", bg: "linear-gradient(180deg, #FF9A6B, #FF6B45)" },
                  { id: "eliminated", label: "Eliminated", bg: "linear-gradient(180deg, #E85D6B, #c03950)" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setForm({ ...form, status: s.id })}
                    style={{
                      ...ui.statusBtn,
                      background: form.status === s.id ? s.bg : "rgba(6,18,22,.85)",
                      color: form.status === s.id ? "#061210" : "#B8D4DA",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {isLive && (
            <div style={ui.inlineFields}>
              <NumberStepField label="Kills" value={form.finishes} onChange={(v) => setForm({ ...form, finishes: v })} />
              <NumberStepField label="Total points" value={form.points} onChange={(v) => setForm({ ...form, points: v })} />
            </div>
          )}

          <div style={ui.buttonRow}>
            <button type="button" style={ui.btnAdd} onClick={createTeam} disabled={busy || isLive}>
              Add Team
            </button>
            <button type="button" style={ui.btnUpdate} onClick={updateTeam} disabled={busy || !selectedTeamId}>
              Update Selected
            </button>
          </div>

          <div style={ui.logoSection}>
            <span style={ui.fieldLabel}>TEAM LOGO</span>
            <div style={ui.logoRow}>
              <div
                style={{
                  ...ui.logoPreview,
                  ...(selectedTeam?.logo || pendingLogo?.url
                    ? {
                        backgroundImage: `url(${teamLogoUrl(selectedTeam?.logo) || pendingLogo?.url})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        color: "transparent",
                      }
                    : {}),
                }}
              >
                {selectedTeam?.logo || pendingLogo?.url ? "" : String(form.team || "??").slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <button
                  type="button"
                  style={ui.logoBtn}
                  onClick={() => triggerLogoPick(selectedTeamId || "new")}
                >
                  {selectedTeam?.logo ? "Change logo" : pendingLogo ? "Change logo" : "Choose logo"}
                </button>
                <p style={ui.logoHint}>PNG, JPG, SVG — appears on Round Robin overlay only.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div style={ui.bottomGrid}>
        <section style={ui.panel}>
          <div style={ui.matchHeaderRow}>
            <h3 style={ui.panelTitle}>Matches</h3>
            <div style={ui.headerActions}>
              <button
                type="button"
                style={ui.btn}
                disabled={busy || isLive}
                title={isLive ? "End the live match first" : "Renumber RR-001, RR-002… and recalculate completed scores"}
                onClick={() => {
                  if (window.confirm("Renumber all matches from RR-001 and recalculate completed match scores?")) {
                    void api("/round-robin/matches/recount");
                  }
                }}
              >
                Recount matches
              </button>
              <button
                type="button"
                style={ui.btnDanger}
                disabled={busy || isLive}
                title={isLive ? "End the live match first" : "Clear all match history and reset to RR-001"}
                onClick={() => {
                  if (
                    window.confirm(
                      "Restart match count?\n\nThis deletes ALL Round Robin match records and standings. Next created match will be RR-001.",
                    )
                  ) {
                    void api("/round-robin/matches/restart-count");
                  }
                }}
              >
                Restart match count
              </button>
            </div>
          </div>
          {(rr.matches || []).length === 0 ? (
            <p style={ui.hint}>No matches yet.</p>
          ) : (
            <ul style={ui.matchList}>
              {[...(rr.matches || [])].reverse().map((m) => (
                <li key={m.id} style={ui.matchRow}>
                  <div>
                    <strong>{m.id}</strong> {m.label}
                    <div style={ui.hint}>{String(m.status).toUpperCase()}</div>
                  </div>
                  {String(m.status).toLowerCase() !== "live" ? (
                    <button
                      type="button"
                      style={ui.btnDangerTiny}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete ${m.id} (${m.label})?`)) {
                          void api(`/round-robin/matches/${m.id}`, { method: "DELETE" });
                        }
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={ui.panel}>
          <h3 style={ui.panelTitle}>Overall standings</h3>
          {(rr.standings || []).length === 0 ? (
            <p style={ui.hint}>End a match to see standings.</p>
          ) : (
            <table style={ui.table}>
              <thead>
                <tr>
                  {["#", "Team", "Group", "Matches", "Kills", "Total"].map((h) => (
                    <th key={h} style={ui.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rr.standings.map((s) => (
                  <tr key={s.teamId}>
                    <td style={ui.td}>{s.rank}</td>
                    <td style={ui.td}>{s.team}</td>
                    <td style={ui.td}>{s.groupName}</td>
                    <td style={ui.td}>{s.matchesPlayed}</td>
                    <td style={ui.td}>{s.totalFinishes}</td>
                    <td style={ui.td}>{s.totalPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

const ui = {
  page: { display: "flex", flexDirection: "column", gap: 16 },
  headerRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16 },
  headerActions: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  kicker: { margin: 0, fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: "#6b8490", textTransform: "uppercase" },
  title: { margin: "6px 0 8px", fontSize: 22, fontWeight: 900, color: "#fff" },
  hint: { margin: 0, fontSize: 13, color: "#8891a1", fontWeight: 600, lineHeight: 1.5 },
  urlBox: { padding: 12, borderRadius: 10, background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.06)" },
  urlCode: { color: "#F1CF69", fontSize: 13, wordBreak: "break-all" },
  banner: { padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)", fontSize: 13, fontWeight: 700 },
  panel: { background: "rgba(0,0,0,.22)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 16 },
  panelTitle: { margin: "0 0 10px", fontSize: 14, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase", color: "#fff" },
  groupGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 12 },
  groupCard: { background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: 12 },
  groupNameInput: { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "#12151c", color: "#fff", fontWeight: 800, boxSizing: "border-box" },
  groupMeta: { margin: "8px 0", fontSize: 11, color: "#8891a1", fontWeight: 600 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 999, background: "rgba(255,255,255,.06)", fontSize: 11, fontWeight: 700, color: "#e8edf4" },
  chipLogo: { width: 16, height: 16, borderRadius: 4, objectFit: "contain" },
  matchGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  checkRow: { display: "flex", alignItems: "center", gap: 8, margin: "12px 0", fontSize: 12, fontWeight: 700, color: "#c5ccd6" },
  dashGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)", gap: 20, alignItems: "start" },
  cardPanel: { background: "#12151c", borderRadius: 16, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.4)" },
  cardPanelHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "18px 20px 14px", borderBottom: "1px solid rgba(255,255,255,.05)" },
  liveBadge: { fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#072512", background: "#43e97b", padding: "4px 10px", borderRadius: 8 },
  rankTitle: { margin: 0, fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 0.8, textTransform: "uppercase" },
  countBadge: { padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,.06)", fontSize: 11, fontWeight: 800, color: "#e8edf4" },
  rankTableHead: {
    display: "grid",
    gridTemplateColumns: "56px minmax(160px,1.3fr) 80px 108px 64px 80px 128px",
    padding: "12px 18px",
    gap: 8,
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
    gridTemplateColumns: "56px minmax(160px,1.3fr) 80px 108px 64px 80px 128px",
    padding: "12px 18px",
    gap: 8,
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,.04)",
    fontSize: 14,
  },
  rankNum: { fontSize: 22, fontWeight: 900, color: "#fff" },
  teamCell: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  teamLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: "rgba(255,255,255,.06)",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 14,
    color: "#fff",
    cursor: "pointer",
    flexShrink: 0,
  },
  teamName: { fontWeight: 900, fontSize: 15, color: "#fff" },
  teamSub: { fontSize: 11, color: "#8891a1", fontWeight: 700 },
  aliveSlot: { width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 11 },
  valueCell: { fontWeight: 900, color: "#e8edf4" },
  actionWrap: { display: "flex", justifyContent: "center", gap: 8 },
  editBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid rgba(80,142,255,.35)",
    background: "linear-gradient(180deg,#2b4acb,#233d9e)",
    color: "#eaf0ff",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },
  iconBtn: { padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.03)", color: "#9aa3b2", cursor: "pointer", fontWeight: 800 },
  empty: { padding: 24, textAlign: "center", color: "#8891a1", fontWeight: 600 },
  addFooter: { display: "flex", justifyContent: "center", padding: 16, borderTop: "1px solid rgba(255,255,255,.06)", background: "#14171f" },
  addMainBtn: { padding: "12px 28px", borderRadius: 10, border: "2px dashed rgba(230,57,70,.55)", background: "transparent", color: "#fff", fontWeight: 900, cursor: "pointer" },
  formCard: { background: "#12151c", borderRadius: 16, border: "1px solid rgba(255,255,255,.06)", padding: 18, position: "sticky", top: 12 },
  formHead: { marginBottom: 14 },
  formTitle: { margin: "6px 0 0", fontSize: 18, fontWeight: 900, color: "#fff" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 },
  fieldLabel: { fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: "#8891a1", textTransform: "uppercase" },
  input: { padding: "11px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "#0d0f14", color: "#fff", fontWeight: 800, fontSize: 14 },
  select: { padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "#12151c", color: "#e8edf4", fontWeight: 700 },
  statusRow: { display: "flex", gap: 8 },
  statusBtn: { flex: 1, minHeight: 44, borderRadius: 12, border: "2px solid rgba(255,255,255,.14)", fontWeight: 900, fontSize: 12, cursor: "pointer", textTransform: "uppercase" },
  inlineFields: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  stepRow: { display: "flex", alignItems: "center", gap: 6 },
  stepBtn: { width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "#1a1d24", color: "#fff", fontWeight: 900, cursor: "pointer" },
  stepInput: { flex: 1, padding: "8px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "#0d0f14", color: "#fff", fontWeight: 900, textAlign: "center" },
  buttonRow: { display: "flex", gap: 10, marginBottom: 14 },
  btnAdd: { flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(180deg,#5CFF72,#3ad65a)", color: "#061210", fontWeight: 900, cursor: "pointer" },
  btnUpdate: { flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "#1e222b", color: "#fff", fontWeight: 900, cursor: "pointer" },
  logoSection: { marginTop: 8, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.06)" },
  logoRow: { display: "flex", gap: 12, alignItems: "center", marginTop: 8 },
  logoPreview: { width: 72, height: 72, borderRadius: 12, background: "rgba(255,255,255,.06)", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 22, color: "#fff" },
  logoBtn: { padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "#1e222b", color: "#e8edf4", fontWeight: 800, cursor: "pointer" },
  logoHint: { margin: "6px 0 0", fontSize: 11, color: "#5a7a82" },
  bottomGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 },
  matchHeaderRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 },
  matchList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 },
  matchRow: {
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  btnDangerTiny: {
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    borderRadius: 8,
    border: "1px solid rgba(248,113,113,.4)",
    background: "rgba(180,70,85,.18)",
    color: "#fecaca",
    cursor: "pointer",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: "#6b8490", padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,.08)" },
  td: { padding: "7px 6px", borderBottom: "1px solid rgba(255,255,255,.05)", color: "#e8edf4" },
  btn: { padding: "10px 16px", fontSize: 12, fontWeight: 800, borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.04)", color: "#e8edf4", cursor: "pointer" },
  btnPrimary: { padding: "10px 16px", fontSize: 12, fontWeight: 800, borderRadius: 10, border: "1px solid rgba(230,57,70,.5)", background: "linear-gradient(160deg,#e63946,#b91c1c)", color: "#fff", cursor: "pointer" },
  btnDanger: { padding: "10px 16px", fontSize: 12, fontWeight: 800, borderRadius: 10, border: "1px solid rgba(248,113,113,.4)", background: "rgba(180,70,85,.18)", color: "#fecaca", cursor: "pointer" },
  btnTiny: { padding: "6px 10px", fontSize: 11, fontWeight: 800, borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.04)", color: "#e8edf4", cursor: "pointer" },
};
