"use client";

import { useState, useMemo, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OddDef {
  label: string;
  value: string;
  active: boolean;
}

interface Match {
  id: number;
  home: string;
  away: string;
  odds: OddDef[];
}

interface Selection {
  matchId: number;
  home: string;
  away: string;
  label: string;
  cote: number;
}

interface Combo {
  sels: Selection[];
  totalCote: number;
}

type SortOrder = "asc" | "desc";

// Predicted outcome per match: null = no filter for that match
type Predictions = Record<number, string | null>;

const PAGE_SIZE = 20;

// ─── Pure helper ─────────────────────────────────────────────────────────────

function generateAllCombos(matches: Match[]): Combo[] {
  const valid = matches.filter(
    (m) =>
      m.home.trim() &&
      m.away.trim() &&
      m.odds.some((o) => o.active && parseFloat(o.value) > 1)
  );
  if (valid.length === 0) return [];

  const perMatch: Selection[][] = valid.map((m) =>
    m.odds
      .filter((o) => o.active && parseFloat(o.value) > 1)
      .map((o) => ({
        matchId: m.id,
        home: m.home,
        away: m.away,
        label: o.label,
        cote: parseFloat(o.value),
      }))
  );

  const product: Selection[][] = perMatch.reduce<Selection[][]>(
    (acc, curr) => acc.flatMap((combo) => curr.map((sel) => [...combo, sel])),
    [[]]
  );

  return product.map((sels) => ({
    sels,
    totalCote: sels.reduce((prod, s) => prod * s.cote, 1),
  }));
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

const CHIP_BG: Record<string, string> = {
  "1": "#22c55e",
  N: "#f97316",
  "2": "#ef4444",
};

function Chip({ label, cote }: { label: string; cote: number }) {
  const bg = CHIP_BG[label] ?? "#6b7280";
  return (
    <span
      style={{
        background: bg,
        color: "#fff",
        borderRadius: 999,
        padding: "2px 9px",
        fontSize: 12,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {cote > 0 && (
        <span style={{ fontWeight: 400, opacity: 0.9 }}>@{cote.toFixed(2)}</span>
      )}
    </span>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  input: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#f1f5f9",
    padding: "8px 12px",
    fontSize: 14,
    width: "100%",
    outline: "none",
  } as React.CSSProperties,

  btnPrimary: {
    background: "#3b82f6",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    padding: "10px 18px",
    fontSize: 14,
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  btnSecondary: {
    background: "#334155",
    border: "none",
    borderRadius: 8,
    color: "#f1f5f9",
    cursor: "pointer",
    fontWeight: 600,
    padding: "10px 14px",
    fontSize: 14,
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: 16,
  } as React.CSSProperties,
};

// ─── Step 1 — Matches ─────────────────────────────────────────────────────────

const BULK_PLACEHOLDER = `Collez vos matchs, un par ligne :
PSG - Bayern : 2.40 3.50 2.80
France - Brésil : 2.10 3.20 3.50
Real - Barça : 1.80 3.40 4.10`;

function parseBulkMatches(text: string): Match[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      // formats: "Team1 - Team2 : 1.5 3.2 2.8" or "Team1 - Team2 1.5 3.2 2.8"
      const colonSplit = line.split(":");
      let teamsPart: string;
      let oddsPart: string;
      if (colonSplit.length >= 2) {
        teamsPart = colonSplit[0].trim();
        oddsPart = colonSplit.slice(1).join(":").trim();
      } else {
        // try to find 3 numbers at the end
        const nums = line.match(/[\d.]+/g);
        if (nums && nums.length >= 3) {
          const lastThree = nums.slice(-3);
          const lastIdx = line.lastIndexOf(lastThree[0]);
          teamsPart = line.slice(0, lastIdx).trim();
          oddsPart = lastThree.join(" ");
        } else {
          teamsPart = line;
          oddsPart = "";
        }
      }

      const teams = teamsPart
        .split(/\s*[-–vs]+\s*/i)
        .map((t) => t.trim())
        .filter(Boolean);
      const oddsNums = oddsPart.match(/[\d.]+/g) ?? [];

      return {
        id: Date.now() + i,
        home: teams[0] ?? "",
        away: teams[1] ?? "",
        odds: [
          { label: "1", value: oddsNums[0] ?? "", active: true },
          { label: "N", value: oddsNums[1] ?? "", active: true },
          { label: "2", value: oddsNums[2] ?? "", active: true },
        ],
      };
    });
}

function StepMatches({
  matches,
  setMatches,
}: {
  matches: Match[];
  setMatches: React.Dispatch<React.SetStateAction<Match[]>>;
}) {
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const add = () =>
    setMatches((prev) => [
      ...prev,
      {
        id: Date.now(),
        home: "",
        away: "",
        odds: [
          { label: "1", value: "", active: true },
          { label: "N", value: "", active: true },
          { label: "2", value: "", active: true },
        ],
      },
    ]);

  const remove = (id: number) =>
    setMatches((prev) => prev.filter((m) => m.id !== id));

  const updateField = (id: number, field: keyof Match, val: string) =>
    setMatches((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: val } : m))
    );

  const updateOdd = (
    matchId: number,
    label: string,
    field: keyof OddDef,
    val: string | boolean
  ) =>
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? {
              ...m,
              odds: m.odds.map((o) =>
                o.label === label ? { ...o, [field]: val } : o
              ),
            }
          : m
      )
    );

  const importBulk = () => {
    const parsed = parseBulkMatches(bulkText);
    if (parsed.length > 0) {
      setMatches((prev) => [...prev, ...parsed]);
      setBulkText("");
      setBulkMode(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Bulk import toggle */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => setBulkMode(!bulkMode)}
          style={{
            ...S.btnSecondary,
            flex: 1,
            background: bulkMode ? "#3b82f6" : "#334155",
          }}
        >
          {bulkMode ? "✕ Fermer import rapide" : "⚡ Import rapide (coller plusieurs matchs)"}
        </button>
      </div>

      {/* Bulk import area */}
      {bulkMode && (
        <div style={S.card}>
          <div
            style={{
              color: "#94a3b8",
              fontSize: 12,
              marginBottom: 8,
              lineHeight: 1.5,
            }}
          >
            Format : <strong>Équipe1 - Équipe2 : cote1 coteN cote2</strong>
          </div>
          <textarea
            placeholder={BULK_PLACEHOLDER}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            style={{
              ...S.input,
              minHeight: 120,
              resize: "vertical",
              fontFamily: "monospace",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={importBulk} style={S.btnPrimary}>
              Importer {parseBulkMatches(bulkText).length || ""} match
              {parseBulkMatches(bulkText).length !== 1 ? "s" : ""}
            </button>
            <button
              onClick={() => {
                const parsed = parseBulkMatches(bulkText);
                if (parsed.length > 0) {
                  setMatches(parsed);
                  setBulkText("");
                  setBulkMode(false);
                }
              }}
              style={S.btnSecondary}
            >
              Remplacer tout
            </button>
          </div>
        </div>
      )}

      {matches.map((m, idx) => (
        <div key={m.id} style={S.card}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                color: "#64748b",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Match {idx + 1}
            </span>
            <button
              onClick={() => remove(m.id)}
              aria-label="Supprimer le match"
              style={{
                background: "none",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: 22,
                lineHeight: 1,
                padding: "0 4px",
              }}
            >
              ×
            </button>
          </div>

          {/* Teams */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
              alignItems: "center",
            }}
          >
            <input
              placeholder="Équipe domicile"
              value={m.home}
              onChange={(e) => updateField(m.id, "home", e.target.value)}
              style={S.input}
            />
            <span
              style={{ color: "#475569", fontWeight: 700, flexShrink: 0 }}
            >
              vs
            </span>
            <input
              placeholder="Équipe extérieure"
              value={m.away}
              onChange={(e) => updateField(m.id, "away", e.target.value)}
              style={S.input}
            />
          </div>

          {/* Odds */}
          <div style={{ display: "flex", gap: 8 }}>
            {m.odds.map((odd) => (
              <div
                key={odd.label}
                style={{
                  flex: 1,
                  background: "#0f172a",
                  borderRadius: 10,
                  padding: 10,
                  border: `1px solid ${
                    odd.active ? (CHIP_BG[odd.label] ?? "#334155") + "70" : "#1e293b"
                  }`,
                  opacity: odd.active ? 1 : 0.45,
                  transition: "opacity 0.2s, border-color 0.2s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: 20,
                      color: CHIP_BG[odd.label] ?? "#f1f5f9",
                    }}
                  >
                    {odd.label}
                  </span>
                  <button
                    onClick={() =>
                      updateOdd(m.id, odd.label, "active", !odd.active)
                    }
                    style={{
                      background: odd.active ? "#22c55e22" : "#334155",
                      border: `1px solid ${odd.active ? "#22c55e" : "#475569"}`,
                      borderRadius: 6,
                      color: odd.active ? "#22c55e" : "#64748b",
                      cursor: "pointer",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 7px",
                      textTransform: "uppercase",
                    }}
                  >
                    {odd.active ? "ON" : "OFF"}
                  </button>
                </div>
                <input
                  type="number"
                  placeholder="Cote"
                  min="1.01"
                  step="0.01"
                  value={odd.value}
                  onChange={(e) =>
                    updateOdd(m.id, odd.label, "value", e.target.value)
                  }
                  style={{ ...S.input, padding: "6px 10px" }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={add}
        style={{
          background: "transparent",
          border: "2px dashed #334155",
          borderRadius: 12,
          color: "#475569",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          padding: 14,
          width: "100%",
        }}
      >
        + Ajouter un match
      </button>
    </div>
  );
}

// ─── Step 2 — Select ──────────────────────────────────────────────────────────

function StepSelect({
  combos,
  selected,
  setSelected,
  matches,
}: {
  combos: Combo[];
  selected: number[];
  setSelected: React.Dispatch<React.SetStateAction<number[]>>;
  matches: Match[];
}) {
  const [minCote, setMinCote] = useState("");
  const [maxCote, setMaxCote] = useState("");
  const [nbMatchs, setNbMatchs] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [predictions, setPredictions] = useState<Predictions>({});
  const [page, setPage] = useState(0);

  // Valid matches (same as in generateAllCombos)
  const validMatches = useMemo(
    () =>
      matches.filter(
        (m) =>
          m.home.trim() &&
          m.away.trim() &&
          m.odds.some((o) => o.active && parseFloat(o.value) > 1)
      ),
    [matches]
  );

  const togglePrediction = useCallback(
    (matchId: number, label: string) => {
      setPredictions((prev) => ({
        ...prev,
        [matchId]: prev[matchId] === label ? null : label,
      }));
      setPage(0);
    },
    []
  );

  const filtered = useMemo(() => {
    const result = combos
      .map((c, i) => ({ ...c, idx: i }))
      .filter((c) => {
        if (minCote && c.totalCote < parseFloat(minCote)) return false;
        if (maxCote && c.totalCote > parseFloat(maxCote)) return false;
        if (nbMatchs && c.sels.length !== parseInt(nbMatchs, 10)) return false;
        // prediction filter: for each match with a prediction, the combo must include that label
        for (const [matchIdStr, label] of Object.entries(predictions)) {
          if (!label) continue;
          const matchId = parseInt(matchIdStr, 10);
          const sel = c.sels.find((s) => s.matchId === matchId);
          if (sel && sel.label !== label) return false;
        }
        return true;
      });

    result.sort((a, b) =>
      sortOrder === "asc"
        ? a.totalCote - b.totalCote
        : b.totalCote - a.totalCote
    );

    return result;
  }, [combos, minCote, maxCote, nbMatchs, predictions, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE
  );

  const allPageChecked =
    pageItems.length > 0 && pageItems.every((c) => selected.includes(c.idx));

  const toggleAllPage = () => {
    if (allPageChecked) {
      const set = new Set(pageItems.map((c) => c.idx));
      setSelected((prev) => prev.filter((i) => !set.has(i)));
    } else {
      setSelected((prev) => [
        ...new Set([...prev, ...pageItems.map((c) => c.idx)]),
      ]);
    }
  };

  const selectAllFiltered = () => {
    setSelected((prev) => [
      ...new Set([...prev, ...filtered.map((c) => c.idx)]),
    ]);
  };

  const deselectAllFiltered = () => {
    const set = new Set(filtered.map((c) => c.idx));
    setSelected((prev) => prev.filter((i) => !set.has(i)));
  };

  const toggle = (idx: number) =>
    setSelected((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );

  const activePredictionCount = Object.values(predictions).filter(Boolean).length;

  return (
    <div>
      {/* ── Prediction filter ─────────────────────────────── */}
      {validMatches.length > 0 && (
        <div
          style={{
            ...S.card,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              color: "#3b82f6",
              fontWeight: 700,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>🎯 Pronostics ({activePredictionCount}/{validMatches.length})</span>
            {activePredictionCount > 0 && (
              <button
                onClick={() => { setPredictions({}); setPage(0); }}
                style={{
                  ...S.btnSecondary,
                  padding: "3px 10px",
                  fontSize: 11,
                }}
              >
                Réinitialiser
              </button>
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {validMatches.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    color: "#94a3b8",
                    fontSize: 12,
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.home} – {m.away}
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  {m.odds
                    .filter((o) => o.active && parseFloat(o.value) > 1)
                    .map((odd) => {
                      const active = predictions[m.id] === odd.label;
                      return (
                        <button
                          key={odd.label}
                          onClick={() => togglePrediction(m.id, odd.label)}
                          style={{
                            background: active
                              ? (CHIP_BG[odd.label] ?? "#6b7280")
                              : "#0f172a",
                            border: `1px solid ${
                              active
                                ? CHIP_BG[odd.label] ?? "#6b7280"
                                : "#334155"
                            }`,
                            borderRadius: 6,
                            color: active ? "#fff" : "#64748b",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "3px 10px",
                            transition:
                              "background 0.15s, border-color 0.15s, color 0.15s",
                          }}
                        >
                          {odd.label}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters & sort ────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          type="number"
          placeholder="Cote min"
          value={minCote}
          onChange={(e) => { setMinCote(e.target.value); setPage(0); }}
          style={{ ...S.input, width: 100 }}
        />
        <input
          type="number"
          placeholder="Cote max"
          value={maxCote}
          onChange={(e) => { setMaxCote(e.target.value); setPage(0); }}
          style={{ ...S.input, width: 100 }}
        />
        <input
          type="number"
          placeholder="Nb matchs"
          value={nbMatchs}
          onChange={(e) => { setNbMatchs(e.target.value); setPage(0); }}
          style={{ ...S.input, width: 110 }}
        />
        <button
          onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
          style={S.btnSecondary}
          title={sortOrder === "asc" ? "Cote croissante" : "Cote décroissante"}
        >
          Cote {sortOrder === "asc" ? "↑" : "↓"}
        </button>
        <button onClick={toggleAllPage} style={S.btnSecondary}>
          {allPageChecked ? "Décocher page" : "Cocher page"}
        </button>
        <span style={{ color: "#64748b", fontSize: 13 }}>
          {filtered.length} ligne{filtered.length !== 1 ? "s" : ""}
          {selected.length > 0 && ` · ${selected.length} sélectionné${selected.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* ── Select all / deselect all filtered ── */}
      {filtered.length > PAGE_SIZE && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <button onClick={selectAllFiltered} style={{ ...S.btnSecondary, fontSize: 12, padding: "6px 12px" }}>
            Tout cocher ({filtered.length})
          </button>
          <button onClick={deselectAllFiltered} style={{ ...S.btnSecondary, fontSize: 12, padding: "6px 12px" }}>
            Tout décocher ({filtered.length})
          </button>
        </div>
      )}

      {/* ── List ──────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {pageItems.length === 0 && (
          <div
            style={{
              color: "#475569",
              textAlign: "center",
              padding: 40,
              fontSize: 14,
            }}
          >
            Aucun combiné ne correspond aux filtres.
          </div>
        )}

        {pageItems.map((combo) => {
          const isSelected = selected.includes(combo.idx);
          return (
            <div
              key={combo.idx}
              onClick={() => toggle(combo.idx)}
              style={{
                background: isSelected ? "#1e3a5f" : "#1e293b",
                border: `1px solid ${isSelected ? "#3b82f6" : "#334155"}`,
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(combo.idx)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  accentColor: "#3b82f6",
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              />
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                {combo.sels.map((sel, si) => (
                  <span
                    key={si}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ color: "#64748b", fontSize: 11 }}>
                      {sel.home}/{sel.away}
                    </span>
                    <Chip label={sel.label} cote={sel.cote} />
                    {si < combo.sels.length - 1 && (
                      <span style={{ color: "#334155", fontSize: 12 }}>·</span>
                    )}
                  </span>
                ))}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}
                >
                  @{combo.totalCote.toFixed(2)}
                </div>
                <div style={{ color: "#64748b", fontSize: 11 }}>
                  {combo.sels.length} match{combo.sels.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pagination ────────────────────────────────────── */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            marginTop: 14,
          }}
        >
          <button
            disabled={safePage === 0}
            onClick={() => setPage(0)}
            style={{
              ...S.btnSecondary,
              padding: "6px 10px",
              fontSize: 12,
              opacity: safePage === 0 ? 0.4 : 1,
              cursor: safePage === 0 ? "not-allowed" : "pointer",
            }}
          >
            «
          </button>
          <button
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{
              ...S.btnSecondary,
              padding: "6px 10px",
              fontSize: 12,
              opacity: safePage === 0 ? 0.4 : 1,
              cursor: safePage === 0 ? "not-allowed" : "pointer",
            }}
          >
            ‹
          </button>
          <span style={{ color: "#94a3b8", fontSize: 13, padding: "0 8px" }}>
            Page {safePage + 1} / {totalPages}
          </span>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            style={{
              ...S.btnSecondary,
              padding: "6px 10px",
              fontSize: 12,
              opacity: safePage >= totalPages - 1 ? 0.4 : 1,
              cursor: safePage >= totalPages - 1 ? "not-allowed" : "pointer",
            }}
          >
            ›
          </button>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
            style={{
              ...S.btnSecondary,
              padding: "6px 10px",
              fontSize: 12,
              opacity: safePage >= totalPages - 1 ? 0.4 : 1,
              cursor: safePage >= totalPages - 1 ? "not-allowed" : "pointer",
            }}
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 3 — Recap ───────────────────────────────────────────────────────────

function StepRecap({
  combos,
  selected,
}: {
  combos: Combo[];
  selected: number[];
}) {
  const [stakes, setStakes] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    selected.forEach((i) => (init[i] = "10"));
    return init;
  });
  const [defaultStake, setDefaultStake] = useState("10");

  const applyDefault = () => {
    const obj: Record<number, string> = {};
    selected.forEach((i) => (obj[i] = defaultStake));
    setStakes(obj);
  };

  const rows = selected.map((i) => {
    const stake = parseFloat(stakes[i] ?? "0") || 0;
    const gain = stake * combos[i].totalCote;
    const profit = gain - stake;
    return { ...combos[i], idx: i, stake, gain, profit };
  });

  const totalStake = rows.reduce((s, r) => s + r.stake, 0);
  const totalGain = rows.reduce((s, r) => s + r.gain, 0);
  const totalProfit = totalGain - totalStake;
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

  return (
    <div>
      {/* Default stake bar */}
      <div
        style={{
          ...S.card,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <span
          style={{ color: "#94a3b8", fontSize: 13, whiteSpace: "nowrap" }}
        >
          Mise par défaut :
        </span>
        <input
          type="number"
          min="0"
          step="1"
          value={defaultStake}
          onChange={(e) => setDefaultStake(e.target.value)}
          style={{ ...S.input, width: 90 }}
        />
        <span style={{ color: "#94a3b8", fontSize: 13 }}>€</span>
        <button onClick={applyDefault} style={S.btnPrimary}>
          Appliquer à tous
        </button>
      </div>

      {/* Combo cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((row) => (
          <div key={row.idx} style={S.card}>
            {/* Selections */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 12,
                alignItems: "center",
              }}
            >
              {row.sels.map((sel, si) => (
                <span
                  key={si}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <span style={{ color: "#475569", fontSize: 11 }}>
                    {sel.home}/{sel.away}
                  </span>
                  <Chip label={sel.label} cote={sel.cote} />
                  {si < row.sels.length - 1 && (
                    <span style={{ color: "#475569", fontSize: 13 }}>→</span>
                  )}
                </span>
              ))}
            </div>

            {/* Financials */}
            <div
              style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <div>
                <div
                  style={{ color: "#64748b", fontSize: 11, marginBottom: 3 }}
                >
                  Cote totale
                </div>
                <div
                  style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 16 }}
                >
                  @{row.totalCote.toFixed(2)}
                </div>
              </div>

              <div>
                <div
                  style={{ color: "#64748b", fontSize: 11, marginBottom: 3 }}
                >
                  Mise (€)
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={stakes[row.idx] ?? ""}
                  onChange={(e) =>
                    setStakes((prev) => ({
                      ...prev,
                      [row.idx]: e.target.value,
                    }))
                  }
                  style={{ ...S.input, width: 80 }}
                />
              </div>

              <div>
                <div
                  style={{ color: "#64748b", fontSize: 11, marginBottom: 3 }}
                >
                  Gain potentiel
                </div>
                <div
                  style={{ color: "#22c55e", fontWeight: 700, fontSize: 16 }}
                >
                  {row.gain.toFixed(2)} €
                </div>
              </div>

              <div>
                <div
                  style={{ color: "#64748b", fontSize: 11, marginBottom: 3 }}
                >
                  Profit net
                </div>
                <div
                  style={{
                    color: row.profit >= 0 ? "#22c55e" : "#ef4444",
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {row.profit >= 0 ? "+" : ""}
                  {row.profit.toFixed(2)} €
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Global summary */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e3a5f",
          borderRadius: 12,
          padding: 18,
          marginTop: 16,
        }}
      >
        <div
          style={{
            color: "#3b82f6",
            fontWeight: 700,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1.2,
            marginBottom: 14,
          }}
        >
          Récapitulatif global
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          {[
            { label: "Combinés", value: String(selected.length), unit: "" },
            { label: "Total misé", value: totalStake.toFixed(2), unit: " €" },
            { label: "Gain max", value: totalGain.toFixed(2), unit: " €" },
            {
              label: "Profit net max",
              value: (totalProfit >= 0 ? "+" : "") + totalProfit.toFixed(2),
              unit: " €",
              color: totalProfit >= 0 ? "#22c55e" : "#ef4444",
            },
            {
              label: "ROI max",
              value: roi.toFixed(1),
              unit: " %",
              color: roi >= 0 ? "#22c55e" : "#ef4444",
            },
          ].map(({ label, value, unit, color }) => (
            <div key={label}>
              <div style={{ color: "#64748b", fontSize: 11, marginBottom: 3 }}>
                {label}
              </div>
              <div
                style={{
                  color: color ?? "#f1f5f9",
                  fontWeight: 700,
                  fontSize: 18,
                }}
              >
                {value}
                {unit}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Initial data ─────────────────────────────────────────────────────────────

const INITIAL_MATCHES: Match[] = [
  {
    id: 1,
    home: "France",
    away: "Brésil",
    odds: [
      { label: "1", value: "2.10", active: true },
      { label: "N", value: "3.20", active: true },
      { label: "2", value: "3.50", active: true },
    ],
  },
  {
    id: 2,
    home: "PSG",
    away: "Bayern",
    odds: [
      { label: "1", value: "2.40", active: true },
      { label: "N", value: "3.50", active: false },
      { label: "2", value: "2.80", active: true },
    ],
  },
];

// ─── App root ─────────────────────────────────────────────────────────────────

export default function CombineGenerator() {
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [selected, setSelected] = useState<number[]>([]);
  const [step, setStep] = useState(0);

  const combos = useMemo(() => generateAllCombos(matches), [matches]);

  const validMatchCount = matches.filter(
    (m) =>
      m.home.trim() &&
      m.away.trim() &&
      m.odds.some((o) => o.active && parseFloat(o.value) > 1)
  ).length;

  const canNext =
    step === 0 ? validMatchCount > 0 : step === 1 ? selected.length > 0 : false;

  const nextLabel =
    step === 0
      ? `Voir ${combos.length} combiné${combos.length !== 1 ? "s" : ""} →`
      : `Récap (${selected.length} sélectionné${selected.length !== 1 ? "s" : ""}) →`;

  const STEP_LABELS = ["Matchs", "Sélection", "Récap"];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
        paddingBottom: 84,
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#1e293b",
          borderBottom: "1px solid #334155",
          padding: "14px 20px 10px",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "-0.4px",
              color: "#f1f5f9",
            }}
          >
            COMBINÉ{" "}
            <span style={{ color: "#3b82f6" }}>BUILDER</span>
          </h1>

          {/* Progress steps */}
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            {STEP_LABELS.map((label, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  cursor: i < step ? "pointer" : "default",
                }}
                onClick={() => i < step && setStep(i)}
              >
                <div
                  style={{
                    height: 3,
                    borderRadius: 2,
                    background: i <= step ? "#3b82f6" : "#334155",
                    transition: "background 0.3s",
                    marginBottom: 4,
                  }}
                />
                <div
                  style={{
                    fontSize: 10,
                    color: i === step ? "#3b82f6" : "#475569",
                    fontWeight: i === step ? 700 : 400,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>
        {step === 0 && (
          <StepMatches matches={matches} setMatches={setMatches} />
        )}
        {step === 1 && (
          <StepSelect
            combos={combos}
            selected={selected}
            setSelected={setSelected}
            matches={matches}
          />
        )}
        {step === 2 && <StepRecap combos={combos} selected={selected} />}
      </div>

      {/* ── Bottom nav ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#1e293b",
          borderTop: "1px solid #334155",
          padding: "12px 16px",
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "0 auto",
            display: "flex",
            gap: 10,
          }}
        >
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              style={{ ...S.btnSecondary, flex: 1 }}
            >
              ← Retour
            </button>
          )}
          {step < 2 && (
            <button
              disabled={!canNext}
              onClick={() => canNext && setStep((s) => s + 1)}
              style={{
                ...S.btnPrimary,
                flex: step > 0 ? 2 : 1,
                opacity: canNext ? 1 : 0.4,
                cursor: canNext ? "pointer" : "not-allowed",
              }}
            >
              {nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
