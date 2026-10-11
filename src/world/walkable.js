import * as THREE from 'three';
import { ISLANDS, radiusAt, surfaceHeight, bridgeHeight } from './layout.js';

const EDGE_MARGIN = 1.3;
const BRIDGE_MARGIN = 0.4;
const _v = new THREE.Vector3();

/**
 * Walkable world: union of island tops (inset from the rim) and bridge decks.
 * Characters can never leave it, so nobody falls off an edge.
 */
export class Walkable {
  constructor(bridges) {
    this.bridges = bridges;
    this.colliders = []; // {x, z, r, island}
    this.platforms = [];
  }

  addCollider(x, z, r, tag) {
    const collider = { x, z, r, tag };
    this.colliders.push(collider);
    return collider;
  }

  addPlatform(x, z, halfWidth, halfDepth, y) {
    this.platforms.push({ x, z, halfWidth, halfDepth, y });
  }

  /** Candidate floor heights at x,z (may be several where a bridge meets an island). */
  floors(x, z, out = []) {
    out.length = 0;
    for (const isl of ISLANDS) {
      const dx = x - isl.center[0], dz = z - isl.center[2];
      const d = Math.hypot(dx, dz);
      if (d > isl.radius * 1.4) continue;
      const r = radiusAt(isl, Math.atan2(dz, dx)) - EDGE_MARGIN;
      if (d < r) out.push({ y: surfaceHeight(isl, x, z), kind: 'island', id: isl.id });
    }
    for (const br of this.bridges) {
      const t = this.bridgeT(br, x, z);
      if (t === null) continue;
      out.push({ y: bridgeHeight(br, t), kind: 'bridge', bridge: br, t });
    }
    for (const platform of this.platforms) {
      if (Math.abs(x - platform.x) <= platform.halfWidth && Math.abs(z - platform.z) <= platform.halfDepth) {
        // The slab replaces the buried terrain beneath it.
        for (const floor of out) floor.y = Math.max(floor.y, platform.y);
      }
    }
    return out;
  }

  bridgeT(br, x, z) {
    const ax = br.pa.x, az = br.pa.z;
    const bx = br.pb.x - ax, bz = br.pb.z - az;
    const len2 = bx * bx + bz * bz;
    const t = ((x - ax) * bx + (z - az) * bz) / len2;
    if (t < 0 || t > 1) return null;
    const px = ax + bx * t, pz = az + bz * t;
    if (Math.hypot(x - px, z - pz) > br.halfWidth - BRIDGE_MARGIN) return null;
    return t;
  }

  /** Highest floor within stepping reach, so bridge decks win over terrain below. */
  groundAt(x, z, y, stepUp = 0.9) {
    const f = this.floors(x, z, this._tmp || (this._tmp = []));
    let best = null;
    for (const o of f) {
      if (o.y > y + stepUp) continue;
      if (!best || o.y > best.y) best = o;
    }
    return best;
  }

  blocked(x, z, radius, ignore = null) {
    for (const c of this.colliders) {
      if (c === ignore) continue;
      const dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < (c.r + radius) ** 2) return c;
    }
    return null;
  }

  /** Resolve a horizontal move with wall sliding. Returns the accepted position. */
  move(pos, dx, dz, y, radius = 0.35, ignore = null) {
    const tryAt = (nx, nz) => {
      const g = this.groundAt(nx, nz, y);
      if (!g) return null;
      if (this.blocked(nx, nz, radius, ignore)) return null;
      return g;
    };
    let g = tryAt(pos.x + dx, pos.z + dz);
    if (g) return _v.set(pos.x + dx, g.y, pos.z + dz);
    g = tryAt(pos.x + dx, pos.z);
    if (g && Math.abs(dx) > 1e-5) return _v.set(pos.x + dx, g.y, pos.z);
    g = tryAt(pos.x, pos.z + dz);
    if (g && Math.abs(dz) > 1e-5) return _v.set(pos.x, g.y, pos.z + dz);
    // push out of colliders if we ended up inside one
    const c = this.blocked(pos.x, pos.z, radius, ignore);
    if (c) {
      const ang = Math.atan2(pos.z - c.z, pos.x - c.x);
      const nx = c.x + Math.cos(ang) * (c.r + radius + 0.01), nz = c.z + Math.sin(ang) * (c.r + radius + 0.01);
      const gg = this.groundAt(nx, nz, y);
      if (gg) return _v.set(nx, gg.y, nz);
    }
    const g0 = this.groundAt(pos.x, pos.z, y);
    return _v.set(pos.x, g0 ? g0.y : y, pos.z);
  }

  /** Is the point within an island's walkable area (used for scatter placement). */
  insideIsland(isl, x, z, margin = 0) {
    const dx = x - isl.center[0], dz = z - isl.center[2];
    return Math.hypot(dx, dz) < radiusAt(isl, Math.atan2(dz, dx)) - margin;
  }

  nearBridge(x, z, extra = 1.5) {
    for (const br of this.bridges) {
      const ax = br.pa.x, az = br.pa.z, bx = br.pb.x - ax, bz = br.pb.z - az;
      let t = ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz);
      t = Math.max(-0.2, Math.min(1.2, t));
      const px = ax + bx * t, pz = az + bz * t;
      if (Math.hypot(x - px, z - pz) < br.halfWidth + extra) return true;
    }
    return false;
  }
}
