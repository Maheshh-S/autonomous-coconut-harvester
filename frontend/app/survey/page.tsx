"use client";

import { useEffect, useRef, useState } from "react";
import AmbientClip from "@/components/AmbientClip";
import { useReveal } from "@/lib/useReveal";
import {
  getMissions,
  createMission,
  uploadSurveyImages,
  getMissionImages,
  completeMission,
  getTileStats,
  getTileGeneration,
  getPermanentTrees,
  createInspection,
  startInspection,
  completeInspection,
  getTreeInspections,
  uploadInspectionImages,
  processInspectionImages,
  getInspectionImages,
  getTreeInventoryHistory,
  createHarvestMission,
  getHarvestMissions,
  getHarvestMission,
  startHarvestMission,
  pauseHarvestMission,
  resumeHarvestMission,
  cancelHarvestMission,
  advanceHarvestMission,
  getRobotStatus,
  type Inspection,
  type InspectionImage,
  type InventorySnapshot,
  type HarvestMission,
  type HarvestType,
  type RobotStatus,
  API_BASE_URL,
} from "@/lib/api/detection";

type Mission = {
  id: number;
  status: string;
  is_active: boolean;
  source_folder: string;
};

type UploadedImage = {
  id: number;
  mission_id: number;
  original_filename: string;
  url: string;
};

type TileStats = {
  mission_id: number;
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  detections_total: number;
  processed_tiles: number;
  remaining_tiles: number;
};

type TileGeneration = {
  mission_id: number;
  images_uploaded: number;
  tiles_generated: number;
  remaining: number;
  generation_status: "not_started" | "in_progress" | "complete";
};

type PermanentTree = {
  id: number;
  tree_code: string;
  gps_lat: number;
  gps_lon: number;
  times_seen: number;
  first_seen_mission_id: number | null;
  last_seen_mission_id: number | null;
  last_matching_confidence: number | null;
  is_new: boolean;
};

type PermanentTrees = {
  mission_id: number;
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  newly_created: number;
  matched_existing: number;
  avg_match_confidence: number | null;
  trees: PermanentTree[];
};

const IMAGE_EXT = /\.(jpe?g|png)$/i;
const FARM_DEFAULT_LAT = 12.1947222;
const FARM_DEFAULT_LON = 76.6100556;

export default function SurveyPage() {
  const reveal = useReveal();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tileStats, setTileStats] = useState<TileStats | null>(null);
  const [tileGen, setTileGen] = useState<TileGeneration | null>(null);
  const [permTrees, setPermTrees] = useState<PermanentTrees | null>(null);
  const [permPage, setPermPage] = useState(1);
  const PERM_PAGE_SIZE = 20;
  const [expandedTree, setExpandedTree] = useState<number | null>(null);
  const [treeInspections, setTreeInspections] = useState<Record<number, Inspection[]>>({});
  const [inspectionImages, setInspectionImages] = useState<Record<number, InspectionImage[]>>({});
  const [treeInventory, setTreeInventory] = useState<
    Record<number, { currentId: number | null; snapshots: InventorySnapshot[] }>
  >({});
  const [inspLoading, setInspLoading] = useState(false);
  const [inspUploading, setInspUploading] = useState<Record<number, boolean>>({});
  const [completeCount, setCompleteCount] = useState<Record<number, number>>({});
  const [harvestType, setHarvestType] = useState<HarvestType>("mature");
  const [harvestMissions, setHarvestMissions] = useState<HarvestMission[]>([]);
  const [selectedHarvest, setSelectedHarvest] = useState<HarvestMission | null>(null);
  const [harvestGenerating, setHarvestGenerating] = useState(false);
  const [robotStatus, setRobotStatus] = useState<RobotStatus | null>(null);
  const [harvestExecuting, setHarvestExecuting] = useState(false);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const loadSeq = useRef(0);

  const selectedMission = missions.find((m) => m.id === selectedMissionId) ?? null;

  async function loadMissions() {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await getMissions();
        const list: Mission[] = data.missions ?? [];
        setMissions(list);
        if (selectedMissionId === null && list.length > 0) {
          setSelectedMissionId(list[0].id);
        }
        return;
      } catch (err) {
        if (attempt === 1) console.error("Failed to load missions", err);
      }
    }
  }

  async function loadImages(missionId: number) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await getMissionImages(missionId);
        setImages(
          (data.images ?? []).map((img: UploadedImage) => ({
            ...img,
            url: API_BASE_URL + img.url,
          }))
        );
        return;
      } catch (err) {
        if (attempt === 1) console.error("Failed to load mission images", err);
      }
    }
  }

  async function loadTileStats(missionId: number) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await getTileStats(missionId);
        setTileStats(data as TileStats);
        return;
      } catch (err) {
        if (attempt === 1) console.error("Failed to load tile statistics", err);
      }
    }
  }

  async function loadTileGeneration(missionId: number) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await getTileGeneration(missionId);
        setTileGen(data as TileGeneration);
        return;
      } catch (err) {
        if (attempt === 1) console.error("Failed to load tile generation progress", err);
      }
    }
  }

  async function loadPermanentTrees(missionId: number, page: number = 1) {
    const seq = ++loadSeq.current;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await getPermanentTrees(missionId, page, PERM_PAGE_SIZE);
        if (seq === loadSeq.current) setPermTrees(data as PermanentTrees);
        return;
      } catch (err) {
        if (attempt === 1) console.error("Failed to load permanent trees", err);
      }
    }
  }

  useEffect(() => {
    loadMissions();
    loadHarvestMissions();
  }, []);

  useEffect(() => {
    if (selectedMissionId === null) {
      setImages([]);
      setTileStats(null);
      return;
    }
    if (uploading) return;
    loadImages(selectedMissionId);
  }, [selectedMissionId, uploading]);

  useEffect(() => {
    if (selectedMissionId === null) return;
    loadTileStats(selectedMissionId);
    loadTileGeneration(selectedMissionId);
    setPermPage(1);
    loadPermanentTrees(selectedMissionId, 1);
  }, [selectedMissionId]);

  useEffect(() => {
    setDone(false);
    setError(null);
    setSuccess(null);
    setTileGen(null);
    setPermTrees(null);
    setPermPage(1);
  }, [selectedMissionId]);

  const canComplete =
    selectedMissionId !== null &&
    selectedMission?.status === "PROCESSING" &&
    images.length > 0 &&
    !processing;

  async function handleComplete() {
    if (selectedMissionId === null) return;
    const confirmed = window.confirm(
      "Complete this Survey Mission? It becomes the active source of truth and further uploads will be disabled."
    );
    if (!confirmed) return;
    setProcessing(true);
    setError(null);
    setSuccess(null);
    try {
      await completeMission(selectedMissionId);
      setSuccess("Survey Mission completed and set active.");
      await loadMissions();
      await loadTileStats(selectedMissionId);
      await loadTileGeneration(selectedMissionId);
      await loadPermanentTrees(selectedMissionId);
    } catch (err) {
      setError("Failed to complete mission: " + (err as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  async function loadTreeInspections(treeId: number): Promise<Inspection[]> {
    try {
      const data = await getTreeInspections(treeId);
      setTreeInspections((prev) => ({ ...prev, [treeId]: data.inspections }));
      return data.inspections;
    } catch (err) {
      setError("Failed to load inspections: " + (err as Error).message);
      return [];
    }
  }

  async function handleStartInspection(treeId: number) {
    setInspLoading(true);
    setError(null);
    try {
      const created = await createInspection(treeId);
      await startInspection(created.id);
      await loadTreeInspections(treeId);
    } catch (err) {
      setError("Failed to start inspection: " + (err as Error).message);
    } finally {
      setInspLoading(false);
    }
  }

  async function handleCompleteInspection(treeId: number, inspId: number) {
    setInspLoading(true);
    setError(null);
    try {
      const count = completeCount[inspId] ?? 1;
      await completeInspection(inspId, count);
      await loadTreeInspections(treeId);
      await loadTreeInventory(treeId);
    } catch (err) {
      setError("Failed to complete inspection: " + (err as Error).message);
    } finally {
      setInspLoading(false);
    }
  }

  async function loadTreeInventory(treeId: number) {
    try {
      const data = await getTreeInventoryHistory(treeId);
      setTreeInventory((prev) => ({
        ...prev,
        [treeId]: {
          currentId: data.current_inventory_id,
          snapshots: data.snapshots,
        },
      }));
    } catch (err) {
      setError("Failed to load inventory: " + (err as Error).message);
    }
  }

  async function loadHarvestMissions() {
    try {
      const data = await getHarvestMissions();
      setHarvestMissions(data.missions);
      if (selectedHarvest === null && data.missions.length > 0) {
        const full = await getHarvestMission(data.missions[0].id);
        setSelectedHarvest(full);
        await refreshRobotStatus(full.id);
      }
    } catch (err) {
      setError("Failed to load harvest missions: " + (err as Error).message);
    }
  }

  async function handleGenerateHarvestMission() {
    setHarvestGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const mission = await createHarvestMission(harvestType);
      setSelectedHarvest(mission);
      setSuccess(
        `${mission.mission_code} created — ${mission.total_trees} tree(s), ${mission.total_expected_coconuts} expected coconuts.`
      );
      await loadHarvestMissions();
    } catch (err) {
      setError("Failed to generate harvest mission: " + (err as Error).message);
    } finally {
      setHarvestGenerating(false);
    }
  }

  async function handleSelectHarvestMission(missionId: number) {
    try {
      const full = await getHarvestMission(missionId);
      setSelectedHarvest(full);
      await refreshRobotStatus(missionId);
    } catch (err) {
      setError("Failed to load harvest mission: " + (err as Error).message);
    }
  }

  async function refreshRobotStatus(missionId: number) {
    try {
      const status = await getRobotStatus(missionId);
      setRobotStatus(status);
    } catch (err) {
      setError("Failed to load robot status: " + (err as Error).message);
    }
  }

  async function runHarvestAction(
    action: "start" | "pause" | "resume" | "cancel" | "advance",
    missionId: number
  ) {
    setHarvestExecuting(true);
    setError(null);
    setSuccess(null);
    try {
      const mission =
        action === "start"
          ? await startHarvestMission(missionId)
          : action === "pause"
            ? await pauseHarvestMission(missionId)
            : action === "resume"
              ? await resumeHarvestMission(missionId)
              : action === "cancel"
                ? await cancelHarvestMission(missionId)
                : await advanceHarvestMission(missionId);
      setSelectedHarvest(mission);
      await loadHarvestMissions();
      await refreshRobotStatus(missionId);
    } catch (err) {
      setError("Failed to " + action + " mission: " + (err as Error).message);
    } finally {
      setHarvestExecuting(false);
    }
  }

  function toggleTree(treeId: number) {
    setExpandedTree((prev) => (prev === treeId ? null : treeId));
    if (expandedTree !== treeId) {
      loadTreeInspections(treeId).then((insps) =>
        insps.forEach((i) => loadInspectionImages(i.id))
      );
      loadTreeInventory(treeId);
    }
  }

  async function loadInspectionImages(inspId: number) {
    try {
      const data = await getInspectionImages(inspId);
      setInspectionImages((prev) => ({ ...prev, [inspId]: data.images }));
    } catch (err) {
      setError("Failed to load inspection images: " + (err as Error).message);
    }
  }

  async function handleUploadInspectionImages(
    treeId: number,
    inspId: number,
    upfiles: File[]
  ) {
    if (upfiles.length === 0) return;
    setInspUploading((prev) => ({ ...prev, [inspId]: true }));
    setError(null);
    try {
      await uploadInspectionImages(inspId, upfiles);
      await processInspectionImages(inspId);
      await loadInspectionImages(inspId);
      await loadTreeInspections(treeId);
    } catch (err) {
      setError("Failed to upload inspection images: " + (err as Error).message);
    } finally {
      setInspUploading((prev) => ({ ...prev, [inspId]: false }));
    }
  }

  async function handleProcessInspectionImages(treeId: number, inspId: number) {
    setInspLoading(true);
    setError(null);
    try {
      await processInspectionImages(inspId);
      await loadInspectionImages(inspId);
      await loadTreeInspections(treeId);
    } catch (err) {
      setError("Failed to process inspection images: " + (err as Error).message);
    } finally {
      setInspLoading(false);
    }
  }

  async function handleCreateMission() {
    const source_folder = newFolder.trim() || `mission_${Date.now()}`;
    try {
      const mission = await createMission({
        source_folder,
        base_gps_lat: FARM_DEFAULT_LAT,
        base_gps_lon: FARM_DEFAULT_LON,
      });
      setNewFolder("");
      setMissions((prev) => [mission, ...prev]);
      setSelectedMissionId(mission.id);
    } catch (err) {
      setError("Could not create mission: " + (err as Error).message);
    }
  }

  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).filter(
      (f) => IMAGE_EXT.test(f.name) || f.type.startsWith("image/")
    );
    setFiles(selected);
    setDone(false);
    setError(null);
  }

  async function handleUpload() {
    if (selectedMissionId === null || files.length === 0) return;
    setUploading(true);
    setError(null);
    setDone(false);
    try {
      for (const file of files) {
        const data = await uploadSurveyImages(selectedMissionId, [file]);
        const uploaded = data.uploaded?.[0];
        if (uploaded) {
          setImages((prev) => [...prev, { ...uploaded, url: API_BASE_URL + uploaded.url }]);
        }
      }
      setDone(true);
    } catch (err) {
      setError("Upload failed: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const total = files.length;
  const uploadedCount = images.length;
  const remaining = Math.max(total - uploadedCount, 0);
  const progress = total > 0 ? Math.round((uploadedCount / total) * 100) : 0;

  return (
    <main className="page" ref={reveal}>
      <header className="page-head">
        <AmbientClip src="/clips/3.mp4" opacity={0.2} />
        <div className="page-head-scrim" />
        <div className="page-head-inner">
          <p className="kicker">Pipeline · Survey → Harvest</p>
          <h1 className="page-title font-display tracking-tightest">Survey &amp; Harvest Control</h1>
        </div>
      </header>

      {error && <div className="banner err"><span className="dot" style={{ background: "var(--color-crit)" }} />{error}</div>}
      {success && <div className="banner ok"><span className="dot" style={{ background: "var(--color-ok)" }} />{success}</div>}

      {/* 1. Mission selection / creation */}
      <section className="step panel" data-reveal>
        <div className="step-head"><span className="step-n">01</span><h2>Select or create a mission</h2></div>
        <div className="row">
          <select
            className="select"
            value={selectedMissionId ?? ""}
            onChange={(e) => setSelectedMissionId(Number(e.target.value))}
          >
            <option value="" disabled>— choose mission —</option>
            {missions.map((m) => (
              <option key={m.id} value={m.id}>#{m.id} — {m.source_folder} ({m.status})</option>
            ))}
          </select>
          <input className="input" placeholder="new folder name" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
          <button className="btn btn-ghost" onClick={handleCreateMission}>Create mission</button>
        </div>
        {selectedMissionId !== null && (
          <p className="hint">Selected mission #{selectedMissionId}</p>
        )}
      </section>

      {/* 2. Folder selection */}
      <section className="step panel" data-reveal>
        <div className="step-head"><span className="step-n">02</span><h2>Select folder of drone imagery</h2></div>
        <input ref={folderInputRef} type="file" multiple accept="image/*" {...({ webkitdirectory: "", directory: "" } as any)} onChange={handleFolderSelect} className="file" />
        <p className="hint">Total images selected: <b>{total}</b></p>
      </section>

      {/* 3. Upload + complete */}
      <section className="step panel" data-reveal>
        <div className="step-head"><span className="step-n">03</span><h2>Upload &amp; activate</h2></div>
        <div className="row">
          <button className="btn btn-primary" onClick={handleUpload} disabled={uploading || selectedMissionId === null || total === 0 || selectedMission?.status !== "PROCESSING"}>
            {uploading ? "Uploading…" : "Upload images"}
          </button>
          <button className="btn" onClick={handleComplete} disabled={!canComplete || processing}
            title={canComplete ? "Mark this mission complete and active" : "Available once a PROCESSING mission has at least one uploaded image"}>
            {processing ? "Processing…" : "Complete Survey Mission"}
          </button>
        </div>

        <div className="progress">
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <div className="progress-meta font-mono">
            <span>Uploaded <b>{uploadedCount}</b></span>
            <span>Remaining <b>{remaining}</b></span>
            <span>Total <b>{total}</b></span>
          </div>
          {done && total > 0 && <p className="hint ok">✓ Upload completed — {uploadedCount} image(s) stored.</p>}
        </div>
      </section>

      {/* Uploaded assets */}
      <section className="step" data-reveal>
        <h2 className="block-title">Uploaded images ({images.length})</h2>
        <div className="grid4">
          {images.map((img) => (
            <div key={img.id} className="thumb">
              <img src={img.url} alt={img.original_filename} loading="lazy" />
              <p className="thumb-name">{img.original_filename}</p>
            </div>
          ))}
        </div>
        {images.length === 0 && <p className="muted">No images uploaded yet.</p>}
      </section>

      {/* Survey Tiles */}
      {selectedMissionId !== null && (
        <section className="step" data-reveal>
          <h2 className="block-title">Survey Tiles</h2>
          {tileStats === null ? (
            <p className="muted">Loading tile statistics…</p>
          ) : tileStats.total === 0 ? (
            <p className="muted">No survey tiles have been generated yet.</p>
          ) : (
            <div className="stat5">
              <Stat n={tileStats.total} l="Total Survey Tiles" />
              <Stat n={tileStats.pending} l="Pending" />
              <Stat n={tileStats.processing} l="Processing" />
              <Stat n={tileStats.completed} l="Completed" />
              <Stat n={tileStats.failed} l="Failed" />
            </div>
          )}
        </section>
      )}

      {/* Detected Trees */}
      {selectedMissionId !== null && (
        <section className="step" data-reveal>
          <h2 className="block-title">Detected Trees</h2>
          {tileStats === null ? (
            <p className="muted">Loading detection progress…</p>
          ) : (
            <div className="stat3">
              <Stat n={tileStats.detections_total} l="Total detections" />
              <Stat n={tileStats.processed_tiles} l="Processed tiles" />
              <Stat n={tileStats.remaining_tiles} l="Remaining tiles" />
            </div>
          )}
        </section>
      )}

      {/* Permanent Trees */}
      {selectedMissionId !== null && (
        <section className="step" data-reveal>
          <h2 className="block-title">Permanent Trees</h2>
          {processing ? (
            <p className="muted">Processing… matching detections to permanent Tree IDs.</p>
          ) : permTrees === null ? (
            <p className="muted">Loading permanent trees…</p>
          ) : permTrees.total === 0 ? (
            <p className="muted">No permanent trees yet. Complete the mission to match detections to permanent Tree IDs.</p>
          ) : (
            <>
              <div className="stat4">
                <Stat n={permTrees.total} l="Total Trees" />
                <Stat n={permTrees.newly_created} l="Newly Created" />
                <Stat n={permTrees.matched_existing} l="Matched Existing" />
                <Stat n={permTrees.avg_match_confidence !== null ? permTrees.avg_match_confidence.toFixed(3) : "—"} l="Avg Match Confidence" />
              </div>

              <div className="tree-list">
                {permTrees.trees.map((t) => {
                  const insps = treeInspections[t.id] || [];
                  const isOpen = expandedTree === t.id;
                  return (
                    <div key={t.id} className="tree-card">
                      <div className="tree-top">
                        <div>
                          <div className="tree-code font-mono">{t.tree_code}</div>
                          <div className="tree-meta">
                            Seen {t.times_seen}× · Match {t.last_matching_confidence !== null ? t.last_matching_confidence.toFixed(3) : "new"} · {t.gps_lat.toFixed(6)}, {t.gps_lon.toFixed(6)}
                          </div>
                        </div>
                        <div className="row">
                          <button type="button" onClick={() => toggleTree(t.id)} className="btn btn-ghost sm">{isOpen ? "Hide History" : "Inspection History"}</button>
                          <button type="button" onClick={() => handleStartInspection(t.id)} disabled={inspLoading} className="btn btn-primary sm">Start Inspection</button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="tree-detail">
                          {(() => {
                            const inv = treeInventory[t.id];
                            const snaps = inv?.snapshots || [];
                            const current = snaps.find((s) => s.id === inv?.currentId) || null;
                            return (
                              <div className="mb3">
                                <h4 className="sub">Current Inventory</h4>
                                {current ? (
                                  <div className="snap current">
                                    <div className="snap-top">
                                      <span className="font-mono"><b>{current.snapshot_code}</b> · {current.total_coconuts} coconuts</span>
                                      <span className="muted sm">{current.created_at ? new Date(current.created_at).toLocaleString() : ""}</span>
                                    </div>
                                    <div className="chip-row">
                                      <span className="chip">Mature: {current.mature_count}</span>
                                      <span className="chip">Potential: {current.potential_count}</span>
                                      <span className="chip">Premature: {current.premature_count}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="muted">No inventory yet. Complete an inspection to build one.</p>
                                )}

                                {snaps.length > 0 && (
                                  <div className="mt2">
                                    <h4 className="sub">Inventory History</h4>
                                    <div className="snap-list">
                                      {snaps.map((s) => (
                                        <div key={s.id} className={"snap" + (s.id === inv?.currentId ? " current" : "")}>
                                          <div className="snap-top">
                                            <span className="font-mono">
                                              {s.snapshot_code}
                                              {s.id === inv?.currentId && <span className="tag-cur">CURRENT</span>}
                                            </span>
                                            <span className="muted sm">{s.created_at ? new Date(s.created_at).toLocaleString() : ""}</span>
                                          </div>
                                          <div className="muted sm">Total: {s.total_coconuts} · Mature: {s.mature_count} · Potential: {s.potential_count} · Premature: {s.premature_count}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          <h4 className="sub">Inspection History</h4>
                          {insps.length === 0 ? (
                            <p className="muted">No inspections yet for this tree.</p>
                          ) : (
                            <div className="insp-list">
                              {insps.map((insp) => {
                                const imgs = inspectionImages[insp.id] || [];
                                const canAddImages = insp.status === "CREATED" || insp.status === "IN_PROGRESS";
                                const inspSnap = (treeInventory[t.id]?.snapshots || []).find((s) => s.inspection_id === insp.id);
                                return (
                                  <div key={insp.id} className="insp">
                                    <div className="insp-top">
                                      <div>
                                        <span className="font-mono">{insp.inspection_code}</span> <span className="status-pill">{insp.status}</span>
                                      </div>
                                      <span className="muted sm">{insp.created_at ? new Date(insp.created_at).toLocaleString() : ""}</span>
                                    </div>
                                    <div className="muted sm">Images: {insp.inspection_image_count}{insp.completed_at ? ` · Completed ${new Date(insp.completed_at).toLocaleString()}` : ""}{insp.notes ? ` · ${insp.notes}` : ""}</div>

                                    {canAddImages && (
                                      <div className="row mt2">
                                        <input type="file" multiple accept="image/*" onChange={(e) => {
                                          const f = e.target.files ? Array.from(e.target.files) : [];
                                          handleUploadInspectionImages(t.id, insp.id, f);
                                          e.target.value = "";
                                        }} className="file sm" disabled={inspUploading[insp.id]} />
                                        <button type="button" onClick={() => handleProcessInspectionImages(t.id, insp.id)} disabled={inspLoading || inspUploading[insp.id]} className="btn btn-ghost sm">Process / Re-scan</button>
                                        <span className="muted sm">{inspUploading[insp.id] ? "Uploading & scanning…" : ""}</span>
                                      </div>
                                    )}

                                    {imgs.length > 0 && (
                                      <div className="mt2">
                                        <div className="sub sm">Inspection Images</div>
                                        {imgs.map((img) => (
                                          <div key={img.id} className="img-row">
                                            <div className="img-row-top">
                                              <span className="trunc">{img.original_filename}</span>
                                              <span className="status-pill">{img.status}</span>
                                            </div>
                                            <div className="muted sm">Detections: {img.detection_count}{img.detection_count > 0 && <span> ({Object.entries(img.detection_summary).map(([k, v]) => `${k}: ${v}`).join(", ")})</span>}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {inspSnap && (
                                      <div className="snap current mt2">
                                        <div className="snap-top">
                                          <span className="muted sm"><b>Inventory Snapshot</b> <span className="font-mono">{inspSnap.snapshot_code}</span></span>
                                          <span className="muted sm">{inspSnap.created_at ? new Date(inspSnap.created_at).toLocaleString() : ""}</span>
                                        </div>
                                        <div className="muted sm">Total: {inspSnap.total_coconuts} · Mature: {inspSnap.mature_count} · Potential: {inspSnap.potential_count} · Premature: {inspSnap.premature_count}</div>
                                      </div>
                                    )}

                                    {(insp.status === "CREATED" || insp.status === "IN_PROGRESS") && (
                                      <div className="row mt2">
                                        <input type="number" min={0} value={completeCount[insp.id] ?? Math.max(imgs.length, 1)} onChange={(e) => setCompleteCount((prev) => ({ ...prev, [insp.id]: Number(e.target.value) }))} className="num" />
                                        <button type="button" onClick={() => handleCompleteInspection(t.id, insp.id)} disabled={inspLoading} className="btn btn-primary sm">Complete</button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {permTrees && permTrees.total_pages > 1 && (
                <div className="pager">
                  <button type="button" onClick={() => { const p = Math.max(1, permPage - 1); setPermPage(p); if (selectedMissionId !== null) loadPermanentTrees(selectedMissionId, p); }} disabled={permPage <= 1} className="btn btn-ghost sm">Previous</button>
                  <span className="muted">Page {permTrees.page} of {permTrees.total_pages}</span>
                  <button type="button" onClick={() => { const p = Math.min(permTrees.total_pages, permPage + 1); setPermPage(p); if (selectedMissionId !== null) loadPermanentTrees(selectedMissionId, p); }} disabled={permPage >= permTrees.total_pages} className="btn btn-ghost sm">Next</button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Harvest Planner & Mission Builder */}
      <section className="step panel" data-testid="harvest-planner" data-reveal>
        <div className="step-head"><span className="step-n">04</span><h2>Harvest Planner</h2></div>
        <p className="muted">Generate a Harvest Mission from the latest Inventory Snapshots. Eligible trees are ordered by a Nearest-Neighbour route. Execute it below to drive the robot through the queue and update Inventory History.</p>
        <div className="row">
          <label className="muted sm" htmlFor="harvest-type">Harvest type</label>
          <select id="harvest-type" className="select" value={harvestType} onChange={(e) => setHarvestType(e.target.value as HarvestType)}>
            <option value="mature">Mature</option>
            <option value="potential">Potential</option>
            <option value="premature">Premature</option>
            <option value="all">All</option>
          </select>
          <button type="button" onClick={handleGenerateHarvestMission} disabled={harvestGenerating} className="btn btn-primary">{harvestGenerating ? "Generating…" : "Generate Harvest Mission"}</button>
        </div>

        {selectedHarvest && (
          <div className="harvest-mission" data-testid="harvest-mission">
            <div className="harvest-head">
              <span className="font-mono lg">{selectedHarvest.mission_code}</span>
              <span className="status-pill big">{selectedHarvest.status}</span>
            </div>
            <div className="chip-row">
              <span className="chip">Harvest type: <b>{selectedHarvest.harvest_type}</b></span>
              <span className="chip">Total trees: <b>{selectedHarvest.total_trees}</b></span>
              <span className="chip">Expected coconuts: <b>{selectedHarvest.total_expected_coconuts}</b></span>
            </div>

            <h3 className="sub">Ordered Tree Queue</h3>
            {selectedHarvest.items && selectedHarvest.items.length > 0 ? (
              <ol className="queue" data-testid="harvest-queue">
                {selectedHarvest.items.map((item) => (
                  <li key={item.id} className={"q-item" + (item.status === "COMPLETED" ? " done" : item.status === "IN_PROGRESS" ? " active" : item.status === "CANCELLED" ? " cancelled" : "")}>
                    <span className="q-n">{item.visit_order}</span>
                    <span className="font-mono">{item.tree_code}</span>
                    <span className="muted sm">Expected: {item.expected_coconuts}</span>
                    {item.harvested !== null && item.harvested !== undefined && <span className="muted sm">Harvested: {item.harvested}</span>}
                    <span className="status-pill sm ml">{item.status}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">No trees in this mission.</p>
            )}

            {/* Robot Mission Execution */}
            <div className="exec">
              <div className="exec-head">
                <h3 className="sub">Robot Status</h3>
                {robotStatus && robotStatus.mission_id === selectedHarvest.id && (
                  <span className="status-pill big" data-testid="robot-state">{robotStatus.robot_state}</span>
                )}
              </div>
              {robotStatus && robotStatus.mission_id === selectedHarvest.id ? (
                <div className="exec-grid">
                  <div className="exec-cell">Mission: <b>{robotStatus.mission_status}</b></div>
                  <div className="exec-cell">Current tree: <b>{robotStatus.current_item ? robotStatus.current_item.tree_code : "—"}</b></div>
                  <div className="exec-cell">Completed: <b>{robotStatus.completed_count}</b></div>
                  <div className="exec-cell">Remaining: <b>{robotStatus.remaining_count}</b></div>
                  <div className="exec-cell">Harvested: <b>{robotStatus.harvested_coconuts}</b></div>
                  <div className="exec-cell">Next tree: <b>{robotStatus.next_item ? robotStatus.next_item.tree_code : "—"}</b></div>
                </div>
              ) : (
                <p className="muted">Start the mission to see robot status.</p>
              )}

              <div className="row mt2">
                {selectedHarvest.status === "CREATED" && (
                  <button type="button" data-testid="harvest-start" onClick={() => runHarvestAction("start", selectedHarvest.id)} disabled={harvestExecuting} className="btn btn-primary">Start Mission</button>
                )}
                {selectedHarvest.status === "RUNNING" && (
                  <>
                    <button type="button" data-testid="harvest-advance" onClick={() => runHarvestAction("advance", selectedHarvest.id)} disabled={harvestExecuting} className="btn btn-primary">Advance to Next Tree</button>
                    <button type="button" data-testid="harvest-pause" onClick={() => runHarvestAction("pause", selectedHarvest.id)} disabled={harvestExecuting} className="btn btn-ghost">Pause</button>
                  </>
                )}
                {selectedHarvest.status === "PAUSED" && (
                  <button type="button" data-testid="harvest-resume" onClick={() => runHarvestAction("resume", selectedHarvest.id)} disabled={harvestExecuting} className="btn btn-primary">Resume</button>
                )}
                {selectedHarvest.status !== "COMPLETED" && selectedHarvest.status !== "CANCELLED" && (
                  <button type="button" data-testid="harvest-cancel" onClick={() => runHarvestAction("cancel", selectedHarvest.id)} disabled={harvestExecuting} className="btn btn-danger">Cancel Mission</button>
                )}
              </div>
              {harvestExecuting && <p className="muted mt2">Working…</p>}
            </div>
          </div>
        )}

        {harvestMissions.length > 0 && (
          <div className="mt2">
            <h3 className="sub">Harvest Missions</h3>
            <div className="mission-list">
              {harvestMissions.map((m) => (
                <button key={m.id} type="button" onClick={() => handleSelectHarvestMission(m.id)} className={"mission-row" + (selectedHarvest?.id === m.id ? " sel" : "")}>
                  <span className="font-mono">{m.mission_code}</span> · {m.harvest_type} · {m.status} · {m.total_trees} tree(s) · {m.total_expected_coconuts} expected · {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Survey Tile Generation */}
      {selectedMissionId !== null && (
        <section className="step" data-reveal>
          <h2 className="block-title">Survey Tile Generation</h2>
          {tileGen === null ? (
            <p className="muted">Loading generation progress…</p>
          ) : (
            <div className="stat4">
              <Stat n={tileGen.images_uploaded} l="Images Uploaded" />
              <Stat n={tileGen.tiles_generated} l="Tiles Generated" />
              <Stat n={tileGen.remaining} l="Remaining" />
              <Stat n={tileGen.generation_status === "complete" ? "Complete" : tileGen.generation_status === "in_progress" ? "In Progress" : "Not Started"} l="Generation Status" />
            </div>
          )}
        </section>
      )}

      <style jsx>{`
        .page { padding: 38px 40px 80px; max-width: 1180px; margin: 0 auto; }
        .page-head {
          position: relative;
          margin-bottom: 28px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--color-line);
          min-height: 210px;
          display: flex;
          align-items: flex-end;
          box-shadow: 0 1px 3px rgba(28, 38, 27, 0.05);
        }
        .page-head-inner { position: relative; z-index: 2; padding: 30px clamp(20px, 3vw, 36px); color: #f4f7ef; }
        .page-head-scrim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(20,30,18,0.15), rgba(20,30,18,0.66)), radial-gradient(120% 140% at 0% 0%, rgba(20,30,18,0.5), transparent);
          pointer-events: none;
        }
        .page-title { font-size: clamp(28px, 4vw, 46px); font-weight: 700; margin-top: 6px; color: #f6f8f2; }
        .page-head .kicker { color: #cdd8c4; }

        .banner {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: var(--radius-md);
          margin-bottom: 16px; font-size: 14px; font-weight: 500;
        }
        .banner.err { background: rgba(255,107,94,0.1); border: 1px solid rgba(255,107,94,0.3); color: #ffb3aa; }
        .banner.ok { background: var(--color-accent-glow); border: 1px solid var(--color-accent-dim); color: var(--color-accent-bright); }

        .step { margin-top: 22px; padding: 26px; }
        .step-head { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
        .step-n {
          font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.1em;
          color: var(--color-accent); border: 1px solid var(--color-accent-dim);
          border-radius: 8px; padding: 5px 9px;
        }
        .step h2 { font-family: var(--font-display); font-size: 20px; font-weight: 600; }
        .block-title {
          font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.24em;
          text-transform: uppercase; color: var(--color-text-faint); margin-bottom: 16px;
        }

        .row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
        .hint { margin-top: 10px; font-size: 13px; color: var(--color-text-dim); }
        .hint.ok { color: var(--color-accent); }

        .file { width: 100%; color: var(--color-text-dim); font-size: 13px; }
        .row .input { flex: 1; min-width: 180px; }
        .file.sm { width: auto; flex: 1; }

        .progress { margin-top: 18px; }
        .progress-bar { height: 8px; border-radius: 99px; background: var(--color-surface-3); overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, var(--color-accent), var(--color-accent-bright)); transition: width 0.4s var(--ease-out); }
        .progress-meta { display: flex; gap: 22px; margin-top: 10px; font-size: 12px; color: var(--color-text-dim); }

        .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .thumb { border: 1px solid var(--color-line); border-radius: var(--radius-md); overflow: hidden; background: var(--color-surface); }
        .thumb img { width: 100%; height: 130px; object-fit: cover; display: block; }
        .thumb-name { font-size: 11px; padding: 7px 9px; color: var(--color-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .stat5, .stat4, .stat3 { display: grid; gap: 12px; }
        .stat5 { grid-template-columns: repeat(5, 1fr); }
        .stat4 { grid-template-columns: repeat(4, 1fr); }
        .stat3 { grid-template-columns: repeat(3, 1fr); }
        .stat-tile { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: 18px; text-align: center; }
        .stat-n { font-family: var(--font-display); font-size: 28px; font-weight: 700; }
        .stat-l { margin-top: 6px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-text-faint); }

        .tree-list { margin-top: 18px; display: flex; flex-direction: column; gap: 12px; }
        .tree-card { border: 1px solid var(--color-line); border-radius: var(--radius-md); background: var(--color-surface); padding: 18px; }
        .tree-top { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
        .tree-code { font-size: 16px; font-weight: 700; color: var(--color-accent); }
        .tree-meta { font-size: 12px; color: var(--color-text-dim); margin-top: 4px; font-family: var(--font-mono); }
        .tree-detail { margin-top: 16px; border-top: 1px solid var(--color-line); padding-top: 16px; }
        .sub { font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 10px; }
        .sub.sm { font-size: 12px; }
        .mb3 { margin-bottom: 14px; }
        .mt2 { margin-top: 12px; }
        .snap { border: 1px solid var(--color-line); border-radius: 10px; padding: 12px; background: var(--color-bg-elevated); }
        .snap.current { border-color: var(--color-accent-dim); background: rgba(79,227,154,0.06); }
        .snap-top { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
        .snap-list { display: flex; flex-direction: column; gap: 8px; }
        .chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .chip { background: var(--color-surface-2); border: 1px solid var(--color-line); border-radius: 8px; padding: 5px 10px; font-size: 12px; color: var(--color-text-dim); }
        .chip b { color: var(--color-text); }
        .tag-cur { margin-left: 8px; background: var(--color-accent); color: #04231a; border-radius: 5px; padding: 1px 6px; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; }
        .insp-list { display: flex; flex-direction: column; gap: 12px; }
        .insp { border: 1px solid var(--color-line); border-radius: 10px; padding: 14px; background: var(--color-bg-elevated); }
        .insp-top { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
        .status-pill { background: var(--color-surface-3); border: 1px solid var(--color-line-strong); border-radius: 99px; padding: 2px 9px; font-size: 11px; color: var(--color-text-dim); font-family: var(--font-mono); letter-spacing: 0.06em; }
        .status-pill.big { font-size: 12px; padding: 4px 12px; color: var(--color-accent-bright); border-color: var(--color-accent-dim); }
        .status-pill.sm { font-size: 10px; }
        .status-pill.ml { margin-left: auto; }
        .img-row { border-top: 1px solid var(--color-line); padding-top: 8px; margin-top: 8px; font-size: 12px; }
        .img-row-top { display: flex; justify-content: space-between; gap: 8px; }
        .trunc { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .muted { color: var(--color-text-faint); font-size: 14px; }
        .muted.sm { font-size: 12px; }

        .harvest-mission { margin-top: 18px; border: 1px solid var(--color-accent-dim); border-radius: var(--radius-md); padding: 20px; background: rgba(79,227,154,0.04); }
        .harvest-head { display: flex; align-items: center; gap: 14px; }
        .lg { font-size: 20px; font-weight: 700; color: var(--color-accent); }
        .queue { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 6px; }
        .q-item { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border: 1px solid var(--color-line); border-radius: 10px; background: var(--color-surface); font-size: 13px; }
        .q-item.done { border-color: var(--color-accent-dim); background: rgba(79,227,154,0.07); }
        .q-item.active { border-color: var(--color-accent); background: rgba(79,227,154,0.12); }
        .q-item.cancelled { opacity: 0.55; }
        .q-n { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; border-radius: 99px; background: var(--color-accent); color: #04231a; font-size: 11px; font-weight: 700; }

        .exec { margin-top: 16px; border: 1px solid var(--color-line); border-radius: 10px; padding: 16px; background: var(--color-bg-elevated); }
        .exec-head { display: flex; align-items: center; justify-content: space-between; }
        .exec-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
        .exec-cell { background: var(--color-surface-2); border-radius: 8px; padding: 9px 11px; font-size: 12px; color: var(--color-text-dim); }
        .exec-cell b { color: var(--color-text); }

        .mission-list { display: flex; flex-direction: column; gap: 6px; }
        .mission-row { text-align: left; border: 1px solid var(--color-line); border-radius: 9px; padding: 9px 12px; font-size: 12px; color: var(--color-text-dim); background: var(--color-surface); cursor: pointer; }
        .mission-row:hover { border-color: var(--color-accent-dim); }
        .mission-row.sel { border-color: var(--color-accent); background: rgba(79,227,154,0.06); }

        .pager { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 18px; }

        .btn.sm { padding: 8px 16px; font-size: 13px; }
        .btn-danger { background: rgba(255,107,94,0.14); color: #ffb3aa; border-color: rgba(255,107,94,0.4); }
        .btn-danger:hover { background: rgba(255,107,94,0.22); }

        @media (max-width: 900px) {
          .grid4, .stat5 { grid-template-columns: repeat(2, 1fr); }
          .exec-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 620px) {
          .page { padding: 28px 20px 60px; }
          .stat4, .stat3, .grid4, .stat5, .exec-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </main>
  );
}

function Stat({ n, l }: { n: React.ReactNode; l: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-n">{n}</div>
      <div className="stat-l">{l}</div>
    </div>
  );
}
