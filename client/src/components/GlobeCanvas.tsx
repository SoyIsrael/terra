import { useEffect, useRef } from "react";
import * as THREE from "three";
import { generateTiles } from "../geo/icosphere";
import { mergeTileData, tileColor, type TileData } from "../geo/tiles";
import { buildTileIndex, pickTile } from "../geo/picking";
import type { GameState } from "@terra/shared";

const RADIUS = 1.0;
const TILE_SHRINK = 0.97;

function v3(v: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

// Returns per-vertex color attribute start index for tile i
// Each tile with n polygon vertices contributes (n-2) triangles × 3 vertices
function buildVertexOffsets(tiles: TileData[]): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const tile of tiles) {
    offsets.push(cursor);
    const verts = (tile.polygon.length - 2) * 3;
    cursor += verts;
  }
  offsets.push(cursor); // sentinel
  return offsets;
}

function buildGlobeMesh(tiles: TileData[]) {
  const positions: number[] = [];
  const colors: number[] = [];
  const edgePositions: number[] = [];
  const col = new THREE.Color();

  for (const tile of tiles) {
    const center = v3(tile.center).multiplyScalar(RADIUS);
    const poly = tile.polygon.map(p =>
      center.clone().lerp(v3(p).multiplyScalar(RADIUS), TILE_SHRINK)
    );
    if (poly.length < 3) continue;

    col.setHex(tileColor(tile));
    for (let i = 1; i < poly.length - 1; i++) {
      for (const pt of [poly[0], poly[i], poly[i + 1]]) {
        positions.push(pt.x, pt.y, pt.z);
        colors.push(col.r, col.g, col.b);
      }
    }

    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      edgePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 10 })
  );

  const edgeGeom = new THREE.BufferGeometry();
  edgeGeom.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
  const edges = new THREE.LineSegments(
    edgeGeom,
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
  );

  const offsets = buildVertexOffsets(tiles);
  return { mesh, edges, offsets };
}

function paintTile(
  colorAttr: THREE.BufferAttribute,
  offsets: number[],
  tileIdx: number,
  hex: number
) {
  const col = new THREE.Color(hex);
  const start = offsets[tileIdx];
  const end = offsets[tileIdx + 1];
  for (let i = start; i < end; i++) {
    colorAttr.setXYZ(i, col.r, col.g, col.b);
  }
  colorAttr.needsUpdate = true;
}

interface HoverInfo {
  tileId: number;
  cost: number | null; // grain cost to claim, null if not claimable
  x: number;
  y: number;
}

interface Props {
  gameState: GameState;
  myId: string | null;
  onTileClick: (tileId: number) => void;
  onHover: (info: HoverInfo | null) => void;
}

export default function GlobeCanvas({ gameState, myId, onTileClick, onHover }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef(gameState);
  const myIdRef = useRef(myId);
  const repaintRef = useRef<(() => void) | null>(null);
  const onTileClickRef = useRef(onTileClick);
  const onHoverRef = useRef(onHover);
  gameStateRef.current = gameState;
  myIdRef.current = myId;
  onTileClickRef.current = onTileClick;
  onHoverRef.current = onHover;

  const markersGroupRef = useRef<THREE.Group | null>(null);
  const tilesRef = useRef<ReturnType<typeof mergeTileData> | null>(null);

  // Repaint tiles whenever server state changes (ownership or day/night)
  useEffect(() => {
    repaintRef.current?.();
  }, [gameState.tiles, gameState.players, gameState.dayAngle]);

  // Rebuild capital markers whenever players change
  useEffect(() => {
    const group = markersGroupRef.current;
    const tiles = tilesRef.current;
    if (!group || !tiles) return;

    // Clear old markers
    while (group.children.length) group.remove(group.children[0]);

    for (const player of Object.values(gameState.players)) {
      if (player.capitalTileId == null || !player.isAlive) continue;
      const tile = tiles[player.capitalTileId];
      if (!tile) continue;

      const color = parseInt(player.color.slice(1), 16);
      const c = tile.center;

      // Outer ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.022, 0.005, 8, 24),
        new THREE.MeshBasicMaterial({ color })
      );
      ring.position.set(c.x * 1.04, c.y * 1.04, c.z * 1.04);
      ring.lookAt(0, 0, 0);
      group.add(ring);

      // Center dot
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.008, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      dot.position.set(c.x * 1.04, c.y * 1.04, c.z * 1.04);
      group.add(dot);
    }
  }, [gameState.players]);

  useEffect(() => {
    const mount = mountRef.current!;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.zIndex = "0";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 3;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xfff5cc, 1.2);
    sun.position.set(5, 0, 0);
    scene.add(sun);

    // Soft fill light for night side — keeps it visible but clearly darker
    const nightFill = new THREE.DirectionalLight(0x223366, 0.3);
    scene.add(nightFill);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.03, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x4488ff, transparent: true, opacity: 0.06, side: THREE.FrontSide,
      })
    );
    scene.add(atmosphere);

    const rawTiles = generateTiles(4);
    const tiles = mergeTileData(rawTiles);
    const { mesh, edges, offsets } = buildGlobeMesh(tiles);
    const tileIndex = buildTileIndex(tiles);

    const markersGroup = new THREE.Group();
    markersGroupRef.current = markersGroup;
    tilesRef.current = tiles;

    const globe = new THREE.Group();
    globe.add(mesh, edges, markersGroup);
    scene.add(globe);

    const colorAttr = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;

    // Sun direction in globe-local space (derived from dayAngle)
    function sunDir(): THREE.Vector3 {
      const angle = (gameStateRef.current.dayAngle * Math.PI) / 180;
      return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    }

    // Darken a hex color by factor 0–1
    function darken(hex: number, factor: number): number {
      const r = Math.floor(((hex >> 16) & 0xff) * factor);
      const g = Math.floor(((hex >> 8) & 0xff) * factor);
      const b = Math.floor((hex & 0xff) * factor);
      return (r << 16) | (g << 8) | b;
    }

    // Repaint all tiles — factors in ownership, elimination, and day/night
    function repaintFromState() {
      const gs = gameStateRef.current;
      const sd = sunDir();

      for (let i = 0; i < tiles.length; i++) {
        const serverTile = gs.tiles[i];
        let baseHex: number;
        if (serverTile?.ownerId) {
          const player = gs.players[serverTile.ownerId];
          // Grey out tiles belonging to eliminated players
          if (player && !player.isAlive) {
            baseHex = 0x555555;
          } else {
            baseHex = player ? parseInt(player.color.slice(1), 16) : 0x888888;
          }
        } else {
          baseHex = tileColor(tiles[i]);
        }

        const c = tiles[i].center;
        const dot = c.x * sd.x + c.y * sd.y + c.z * sd.z;
        const light = Math.max(0.6, Math.min(1.0, dot * 2 + 0.75));
        paintTile(colorAttr, offsets, i, darken(baseHex, light));
      }
    }

    // Expose repaint so the outer useEffect can call it
    repaintRef.current = repaintFromState;

    // Picking state
    let hoveredId = -1;
    let isDragging = false;
    let dragMoved = false;
    let prevMouse = { x: 0, y: 0 };

    const mouseNDC = new THREE.Vector2();

    function getNDC(e: MouseEvent) {
      const rect = mount.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
    }

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
        globe.rotation.y += dx * 0.005;
        globe.rotation.x += dy * 0.005;
        atmosphere.rotation.copy(globe.rotation);
        prevMouse = { x: e.clientX, y: e.clientY };
        return;
      }

      // Hover highlight
      mouseNDC.copy(getNDC(e));
      globe.updateMatrixWorld();
      const hit = pickTile(tileIndex, globe, camera, mouseNDC);

      if (hit?.id !== hoveredId) {
        if (hoveredId >= 0) repaintRef.current?.();
        hoveredId = hit?.id ?? -1;
        if (hoveredId >= 0) {
          paintTile(colorAttr, offsets, hoveredId, 0xffffff);
          // Compute cost for tooltip
          const gs = gameStateRef.current;
          const existingOwner = gs.tiles[hoveredId]?.ownerId ?? null;
          const isExpansion = gs.phase === "expansion";
          let cost: number | null = null;
          if (isExpansion && existingOwner !== myIdRef.current) {
            cost = existingOwner ? 15 : 5;
          }
          onHoverRef.current({ tileId: hoveredId, cost, x: e.clientX, y: e.clientY });
        } else {
          onHoverRef.current(null);
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragMoved = false;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = (e: MouseEvent) => {
      isDragging = false;
      if (dragMoved) return;

      const ndc = getNDC(e);
      globe.updateMatrixWorld();
      const hit = pickTile(tileIndex, globe, camera, ndc);
      if (hit) onTileClickRef.current(hit.id);
    };

    mount.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);

    const onWheel = (e: WheelEvent) => {
      camera.position.z = Math.max(1.5, Math.min(6, camera.position.z + e.deltaY * 0.002));
    };
    mount.addEventListener("wheel", onWheel, { passive: true });

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      atmosphere.rotation.y = globe.rotation.y;

      // Move sun light to match server dayAngle (in world space, not globe-local)
      const angle = (gameStateRef.current.dayAngle * Math.PI) / 180;
      sun.position.set(Math.cos(angle) * 5, 0, Math.sin(angle) * 5);
      nightFill.position.set(-Math.cos(angle) * 5, 0, -Math.sin(angle) * 5);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      mount.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      mount.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" />;
}
