// Rendering: everything the player sees, painted on one canvas in a camera
// that follows the player. The world is drawn in layers — sea and sand, grass,
// roads with lane paint, parks, buildings with shaded roofs and windows,
// trees, cars, people, bullets and particles — then the HUD: money, health,
// wanted stars, the mission objective, the speedometer and the minimap.
// Menus (title, pause, busted, wasted, story complete) are drawn over the
// world. All colours come from config.js; nothing here loads a file.
import { AVENUES, DISTRICTS, FONT, FONT_DISPLAY, PALETTE, ROAD_W, WORLD } from './config.js';
import { STREETS_LIST, districtAt } from './city.js';
import { MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_DONE = 'done';

const VIEW_W = 1280;
const VIEW_H = 720;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function frame(state, screen, save) {
    const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    drawWorld(state);
    drawEntities(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state);
    if (screen === SCREEN_TITLE) drawTitle(state, save);
    else if (screen === SCREEN_PAUSED) drawPause(state);
    else if (screen === SCREEN_BUSTED) drawEnd(state, 'BUSTED', 'The Solmar Bay PD has you. The garage posts bail — $200 — and Mara walks out before lunch.');
    else if (screen === SCREEN_WASTED) drawEnd(state, 'WASTED', 'Mara wakes up at Solmar General, $200 lighter and twice as stubborn.');
    else if (screen === SCREEN_DONE) drawEnd(state, 'KING OF SOLMAR', 'Six jobs, one city. Mara Voss owns Solmar Bay now — and the Bay knows it.');
  }

  function cam(state) {
    const p = state.player;
    const fx = p.car ? p.car.x : p.x;
    const fy = p.car ? p.car.y : p.y;
    return {
      x: Math.max(VIEW_W / 2, Math.min(WORLD.width - VIEW_W / 2, fx)),
      y: Math.max(VIEW_H / 2, Math.min(WORLD.height - VIEW_H / 2, fy)),
    };
  }

  function drawWorld(state) {
    const c = cam(state);
    const ox = c.x - VIEW_W / 2;
    const oy = c.y - VIEW_H / 2;
    ctx.save();
    ctx.translate(-ox, -oy);
    // Sea, sand, grass.
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(ox - 20, oy - 20, VIEW_W + 40, VIEW_H + 40);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(ox - 20, oy - 20, 70, VIEW_H + 40);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(70, oy - 20, 140, VIEW_H + 40);
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(210, oy - 20, WORLD.width - 210 + 40, VIEW_H + 40);
    // Mow stripes on the grass for texture.
    ctx.fillStyle = PALETTE.grassDark;
    const stripe = 120;
    const yStart = Math.floor(oy / stripe) * stripe;
    for (let y = yStart; y < oy + VIEW_H; y += stripe * 2) {
      ctx.fillRect(210, y, WORLD.width - 210, stripe);
    }
    // Parks.
    for (const park of state.city.parks) {
      if (!inView(park, ox, oy)) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.strokeStyle = '#4a7a3a';
      ctx.lineWidth = 3;
      ctx.strokeRect(park.x, park.y, park.w, park.h);
    }
    // Parking lots.
    for (const lot of state.city.lots) {
      if (!inView(lot, ox, oy)) continue;
      ctx.fillStyle = '#9a948a';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = '#e8e4da';
      ctx.lineWidth = 2;
      for (let x = lot.x + 30; x < lot.x + lot.w - 20; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, lot.y + 14);
        ctx.lineTo(x, lot.y + lot.h - 14);
        ctx.stroke();
      }
    }
    // Roads.
    drawRoads(ox, oy);
    // Buildings.
    for (const b of state.city.buildings) {
      if (!inView(b, ox, oy)) continue;
      drawBuilding(b);
    }
    for (const b of state.city.landmarks) {
      if (!inView(b, ox, oy)) continue;
      drawBuilding(b);
      ctx.fillStyle = '#1d2b3a';
      ctx.font = 'bold 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y - 8);
    }
    // Trees.
    for (const t of state.city.trees) {
      if (t.x < ox - 30 || t.x > ox + VIEW_W + 30 || t.y < oy - 30 || t.y > oy + VIEW_H + 30) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(t.x + 4, t.y + 6, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeLight;
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    // Beach umbrellas and the pier.
    drawBeach(state, ox, oy);
    ctx.restore();
    // Sun tint: warm afternoon light over everything.
    ctx.fillStyle = 'rgba(255, 190, 90, 0.05)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function inView(r, ox, oy) {
    return r.x + r.w > ox - 40 && r.x < ox + VIEW_W + 40 && r.y + r.h > oy - 40 && r.y < oy + VIEW_H + 40;
  }

  function drawRoads(ox, oy) {
    const half = ROAD_W / 2;
    ctx.fillStyle = PALETTE.road;
    for (const ax of AVENUES) ctx.fillRect(ax - half, oy - 20, ROAD_W, VIEW_H + 40);
    for (const sy of STREETS_LIST) ctx.fillRect(ox - 20, sy - half, VIEW_W + 40, ROAD_W);
    // Edge lines.
    ctx.strokeStyle = PALETTE.roadEdge;
    ctx.lineWidth = 3;
    for (const ax of AVENUES) {
      ctx.beginPath(); ctx.moveTo(ax - half, oy - 20); ctx.lineTo(ax - half, oy + VIEW_H + 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax + half, oy - 20); ctx.lineTo(ax + half, oy + VIEW_H + 20); ctx.stroke();
    }
    for (const sy of STREETS_LIST) {
      ctx.beginPath(); ctx.moveTo(ox - 20, sy - half); ctx.lineTo(ox + VIEW_W + 20, sy - half); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox - 20, sy + half); ctx.lineTo(ox + VIEW_W + 20, sy + half); ctx.stroke();
    }
    // Dashed centre lines.
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (const ax of AVENUES) {
      ctx.beginPath(); ctx.moveTo(ax, oy - 20); ctx.lineTo(ax, oy + VIEW_H + 20); ctx.stroke();
    }
    for (const sy of STREETS_LIST) {
      ctx.beginPath(); ctx.moveTo(ox - 20, sy); ctx.lineTo(ox + VIEW_W + 20, sy); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(245,241,230,0.75)';
    for (const ax of AVENUES) {
      for (const sy of STREETS_LIST) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(ax + i * 12 - 4, sy - half - 2, 8, 10);
          ctx.fillRect(ax + i * 12 - 4, sy + half - 8, 8, 10);
        }
      }
    }
  }

  function drawBuilding(b) {
    const h = b.height || 1;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + h * 4, b.y + h * 5, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x, b.y, b.w, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    if (b.windows && b.w > 60 && b.h > 50) {
      ctx.fillStyle = 'rgba(180,220,240,0.85)';
      for (let wx = b.x + 14; wx < b.x + b.w - 18; wx += 30) {
        for (let wy = b.y + 16; wy < b.y + b.h - 18; wy += 30) {
          ctx.fillRect(wx, wy, 14, 16);
        }
      }
    }
  }

  function drawBeach(state, ox, oy) {
    // Pier at the Marina.
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(60, 220, 130, 18);
    ctx.fillStyle = '#a87f58';
    for (let x = 66; x < 190; x += 16) ctx.fillRect(x, 220, 8, 18);
    // Umbrellas dotted along the sand.
    const umbrellas = [[120, 420], [150, 700], [110, 1000], [160, 1350], [120, 1700], [150, 2000]];
    for (const [ux, uy] of umbrellas) {
      if (uy < oy - 40 || uy > oy + VIEW_H + 40) continue;
      ctx.fillStyle = '#e85d8a';
      ctx.beginPath();
      ctx.arc(ux, uy, 16, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f5f1e6';
      ctx.beginPath();
      ctx.arc(ux, uy, 16, Math.PI, Math.PI * 1.5);
      ctx.fill();
      ctx.strokeStyle = '#7a5a3a';
      ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux, uy + 14); ctx.stroke();
    }
    // Waves at the waterline.
    ctx.strokeStyle = 'rgba(245,241,230,0.6)';
    ctx.lineWidth = 3;
    for (let y = oy - (oy % 90); y < oy + VIEW_H; y += 90) {
      ctx.beginPath();
      ctx.moveTo(64, y);
      ctx.quadraticCurveTo(50, y + 12, 64, y + 24);
      ctx.stroke();
    }
  }

  function drawEntities(state) {
    const c = cam(state);
    const ox = c.x - VIEW_W / 2;
    const oy = c.y - VIEW_H / 2;
    ctx.save();
    ctx.translate(-ox, -oy);
    // Pickups.
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(state.time * 3 + pk.x) * 3;
      ctx.fillStyle = pk.kind === 'cash' ? PALETTE.gold : pk.kind === 'health' ? '#e5534b' : '#4fc3f7';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#1d2b3a';
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'W', pk.x, pk.y + bob);
      ctx.textBaseline = 'alphabetic';
    }
    // Mission marker.
    const marker = state.marker;
    if (marker) {
      const pulse = 1 + Math.sin(state.time * 4) * 0.12;
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, marker.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(242,201,76,0.15)';
      ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.moveTo(marker.x, marker.y - 46);
      ctx.lineTo(marker.x - 12, marker.y - 22);
      ctx.lineTo(marker.x + 12, marker.y - 22);
      ctx.closePath();
      ctx.fill();
    }
    // Cars, sorted by y so nearer ones overlap correctly.
    const cars = state.cars.slice().sort((a, b) => a.y - b.y);
    for (const car of cars) drawCar(car, state.time);
    // Pedestrians and cops.
    for (const ped of state.peds) drawPed(ped);
    for (const cop of state.cops) drawCop(cop);
    // Player.
    drawPlayer(state);
    // Bullets.
    for (const b of state.bullets) {
      ctx.strokeStyle = b.friendly ? '#ffe08a' : '#ff8a7a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      const a = Math.max(0, pt.life / pt.max);
      if (pt.kind === 'smoke') {
        ctx.fillStyle = `rgba(80,80,80,${a * 0.6})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 10 + (1 - a) * 14, 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.kind === 'spark') {
        ctx.fillStyle = `rgba(255,200,80,${a})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(40,40,40,${a * 0.7})`;
        ctx.fillRect(pt.x - 4, pt.y - 2, 8, 4);
      }
    }
    ctx.restore();
  }

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const len = car.model.len;
    const wid = car.model.wid;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    ctx.fillStyle = car.model.color;
    roundRect(-len / 2, -wid / 2, len, wid, 8);
    ctx.fill();
    if (car.police) {
      ctx.fillStyle = '#f5f1e6';
      ctx.fillRect(-4, -wid / 2, 12, wid);
      ctx.fillStyle = '#1d2b3a';
      ctx.font = 'bold 9px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
      const on = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = on ? '#ff3b30' : '#2b6cff';
      ctx.fillRect(-6, -wid / 2 - 3, 12, 5);
    }
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    ctx.fillRect(len * 0.12, -wid / 2 + 4, len * 0.2, wid - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-len * 0.28, -wid / 2 + 4, len * 0.22, wid - 8);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 6);
    ctx.fillRect(len / 2 - 3, wid / 2 - 9, 3, 6);
    ctx.fillStyle = '#14181f';
    ctx.fillRect(-len / 2 + 6, -wid / 2 - 3, 12, 5);
    ctx.fillRect(-len / 2 + 6, wid / 2 - 2, 12, 5);
    ctx.fillRect(len / 2 - 18, -wid / 2 - 3, 12, 5);
    ctx.fillRect(len / 2 - 18, wid / 2 - 2, 12, 5);
    ctx.restore();
    if (car.hp < 30 && !car.police) {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = 'rgba(60,60,60,0.35)';
      roundRect(-car.model.len / 2, -car.model.wid / 2, car.model.len, car.model.wid, 8);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPed(ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.dead) {
      ctx.rotate(ped.fall * Math.PI / 2);
      ctx.globalAlpha = 0.85;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const swing = ped.state === 'idle' || ped.dead ? 0 : Math.sin(ped.walkPhase) * 4;
    ctx.strokeStyle = ped.pants;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-3 + swing, 10);
    ctx.moveTo(0, 0); ctx.lineTo(3 - swing, 10);
    ctx.stroke();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, -2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, -14, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(0, -16, 6, Math.PI, 0);
    ctx.fill();
    ctx.restore();
  }

  function drawCop(cop) {
    if (cop.down) {
      ctx.save();
      ctx.translate(cop.x, cop.y);
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#2b6cb0';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1d2b3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-3, 10);
    ctx.moveTo(0, 0); ctx.lineTo(3, 10);
    ctx.stroke();
    ctx.fillStyle = '#2b6cb0';
    ctx.beginPath();
    ctx.arc(0, -2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, -14, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d2b3a';
    ctx.beginPath();
    ctx.arc(0, -16, 6, Math.PI, 0);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.car) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 6, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    const swing = p.moving ? Math.sin(state.time * 12) * 4 : 0;
    ctx.strokeStyle = '#2b3a4a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-3 + swing, 10);
    ctx.moveTo(0, 0); ctx.lineTo(3 - swing, 10);
    ctx.stroke();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, -2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, -14, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2b1a';
    ctx.beginPath();
    ctx.arc(0, -16, 6, Math.PI, 0);
    ctx.fill();
    if (p.aiming) {
      ctx.fillStyle = '#1d2b3a';
      ctx.fillRect(6, -4, 14, 4);
      if (state.muzzle > 0) {
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath();
        ctx.arc(24, -2, 6 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    if (p.moving) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = 'rgba(242,201,76,0.9)';
      ctx.beginPath();
      ctx.moveTo(22, 0); ctx.lineTo(12, -5); ctx.lineTo(12, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHud(state) {
    const p = state.player;
    panel(16, 14, 250, 108);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 26px ' + FONT_DISPLAY;
    ctx.textAlign = 'left';
    ctx.fillText('$' + Math.floor(p.money).toLocaleString('en-US'), 30, 46);
    ctx.fillStyle = '#333a44';
    ctx.fillRect(30, 58, 180, 12);
    ctx.fillStyle = p.hp > 40 ? '#5aa86e' : '#e5534b';
    ctx.fillRect(30, 58, 180 * Math.max(0, p.hp / 100), 12);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '13px ' + FONT;
    ctx.fillText('HP ' + Math.floor(p.hp), 216, 69);
    for (let i = 0; i < 5; i += 1) {
      drawStar(40 + i * 26, 98, i < state.wanted);
    }
    if (state.bustMeter > 0.05) {
      ctx.fillStyle = '#e5534b';
      ctx.font = 'bold 14px ' + FONT;
      ctx.fillText('BUSTED IN ' + Math.ceil((1 - state.bustMeter) * 2) + 's — RUN!', 30, 140);
    }
    const d = districtAt(p.car ? p.car.x : p.x, p.car ? p.car.y : p.y);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 16px ' + FONT_DISPLAY;
    ctx.fillText(d.name.toUpperCase(), 286, 34);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + FONT;
    ctx.fillText(state.clock, 286, 54);
    if (state.missions.active) {
      const stage = state.missions.active.stages[state.missions.stage];
      const text = stage ? stage.text : '';
      const w = Math.min(560, 40 + ctx.measureText(text).width);
      panel(VIEW_W / 2 - w / 2 - 60, 14, w + 120, 52);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(state.missions.active.title.toUpperCase(), VIEW_W / 2, 34);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '14px ' + FONT;
      ctx.fillText(text, VIEW_W / 2, 54);
      ctx.textAlign = 'left';
      if (stage && stage.timer !== undefined && state.missions.stageT > 0) {
        ctx.fillStyle = '#e5534b';
        ctx.font = 'bold 16px ' + FONT;
        ctx.fillText(Math.ceil(state.missions.stageT) + 's', VIEW_W / 2 + w / 2 + 8, 40);
      }
    } else if (state.missions.index < MISSIONS.length) {
      panel(VIEW_W / 2 - 150, 14, 300, 40);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '14px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('Press M — next job: ' + MISSIONS[state.missions.index].title, VIEW_W / 2, 40);
      ctx.textAlign = 'left';
    }
    if (state.messageT > 0 && state.message) {
      ctx.fillStyle = 'rgba(12,16,24,0.8)';
      const mw = Math.min(760, ctx.measureText(state.message).width + 40);
      roundRect(VIEW_W / 2 - mw / 2, 78, mw, 34, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = '14px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(state.message, VIEW_W / 2, 100);
      ctx.textAlign = 'left';
    }
    drawMinimap(state);
    ctx.fillStyle = 'rgba(12,16,24,0.6)';
    roundRect(16, VIEW_H - 58, 430, 42, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + FONT;
    ctx.fillText(p.car ? 'WASD drive · Space handbrake · E exit car · M mission · P pause' : 'WASD move · Shift run · E steal car · Click shoot · M mission · P pause', 28, VIEW_H - 32);
    if (p.car) {
      panel(VIEW_W - 210, VIEW_H - 96, 194, 80);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 30px ' + FONT_DISPLAY;
      ctx.textAlign = 'right';
      ctx.fillText(Math.floor(Math.abs(p.car.speed) * 0.18) + ' mph', VIEW_W - 30, VIEW_H - 54);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '13px ' + FONT;
      ctx.fillText(p.car.model.name + (p.car.stolen ? ' · STOLEN' : ''), VIEW_W - 30, VIEW_H - 32);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#333a44';
      ctx.fillRect(VIEW_W - 194, VIEW_H - 26, 162, 8);
      ctx.fillStyle = p.car.hp > 40 ? '#5aa86e' : '#e5534b';
      ctx.fillRect(VIEW_W - 194, VIEW_H - 26, 162 * Math.max(0, p.car.hp / 100), 8);
    }
    if (!p.car) {
      const m = state.mouse;
      ctx.strokeStyle = 'rgba(245,241,230,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x - 14, m.y); ctx.lineTo(m.x - 6, m.y);
      ctx.moveTo(m.x + 6, m.y); ctx.lineTo(m.x + 14, m.y);
      ctx.moveTo(m.x, m.y - 14); ctx.lineTo(m.x, m.y - 6);
      ctx.moveTo(m.x, m.y + 6); ctx.lineTo(m.x, m.y + 14);
      ctx.stroke();
    }
  }

  function drawStar(x, y, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = filled ? PALETTE.gold : 'rgba(245,241,230,0.25)';
    ctx.strokeStyle = '#1d2b3a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? 11 : 5;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawMinimap(state) {
    const mw = 208;
    const mh = 156;
    const mx = VIEW_W - mw - 16;
    const my = 14;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    panel(mx - 6, my - 6, mw + 12, mh + 12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#6a9a4e';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2f8fc4';
    ctx.fillRect(mx, my, 200 * sx, mh);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(mx + 70 * sx, my, 140 * sx, mh);
    ctx.fillStyle = '#3a3f47';
    for (const ax of AVENUES) ctx.fillRect(mx + ax * sx - 1, my, 3, mh);
    for (const sy2 of STREETS_LIST) ctx.fillRect(mx, my + sy2 * sy - 1, mw, 3);
    const marker = state.marker;
    if (marker) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(mx + marker.x * sx, my + marker.y * sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1d2b3a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const car of state.cars) {
      if (!car.police) continue;
      ctx.fillStyle = '#2b6cff';
      ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 5, 5);
    }
    const p = state.player;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mx + px * sx, my + py * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1d2b3a';
    ctx.lineWidth = 2;
    ctx.stroke();
    const c = cam(state);
    ctx.strokeStyle = 'rgba(245,241,230,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + (c.x - VIEW_W / 2) * sx, my + (c.y - VIEW_H / 2) * sy, VIEW_W * sx, VIEW_H * sy);
    ctx.restore();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('SOLMAR BAY', mx + mw / 2, my + mh + 22);
    ctx.textAlign = 'left';
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,241,230,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTitle(state, save) {
    ctx.fillStyle = 'rgba(10,14,22,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 84px ' + FONT_DISPLAY;
    ctx.fillText('SOLMAR BAY', VIEW_W / 2, 190);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '26px ' + FONT_DISPLAY;
    ctx.fillText('Sun, Sand & Sirens', VIEW_W / 2, 232);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '16px ' + FONT;
    ctx.fillText('An open-world crime story — Mara Voss takes back her city, one job at a time.', VIEW_W / 2, 268);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '17px ' + FONT;
    ctx.fillText('WASD move / drive · Shift sprint · E steal & exit cars · Mouse aim, click shoot', VIEW_W / 2, 330);
    ctx.fillText('Space handbrake · M start next job · P pause · progress saves automatically', VIEW_W / 2, 356);
    const done = state.missions.done.length;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillText(done > 0 ? `Jobs done: ${done} of 6 — $${Math.floor(state.player.money)} in the pocket` : 'Six jobs. One city. No rules but hers.', VIEW_W / 2, 410);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px ' + FONT_DISPLAY;
    const blink = Math.floor(state.time * 2) % 2 === 0;
    if (blink) ctx.fillText(save ? 'CLICK OR PRESS ENTER — CONTINUE' : 'CLICK OR PRESS ENTER — NEW GAME', VIEW_W / 2, 470);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + FONT;
    ctx.fillText('An original game. Solmar Bay, Mara Voss, Dario Kestrel and Lena Sol are invented here — no borrowed city, no borrowed names.', VIEW_W / 2, 640);
    ctx.fillText('Best played in desktop Chrome, keyboard + mouse. Sound on for sirens and engines.', VIEW_W / 2, 662);
    ctx.textAlign = 'left';
  }

  function drawPause(state) {
    ctx.fillStyle = 'rgba(10,14,22,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 52px ' + FONT_DISPLAY;
    ctx.fillText('PAUSED', VIEW_W / 2, 300);
    ctx.font = '18px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('P or Esc to resume · progress is saved automatically', VIEW_W / 2, 350);
    ctx.fillText(`Jobs done: ${state.missions.done.length} of 6 · $${Math.floor(state.player.money)}`, VIEW_W / 2, 380);
    ctx.textAlign = 'left';
  }

  function drawEnd(state, title, sub) {
    ctx.fillStyle = 'rgba(10,14,22,0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = title === 'WASTED' ? '#e5534b' : title === 'BUSTED' ? '#4fc3f7' : PALETTE.gold;
    ctx.font = 'bold 72px ' + FONT_DISPLAY;
    ctx.fillText(title, VIEW_W / 2, 320);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '18px ' + FONT;
    ctx.fillText(sub, VIEW_W / 2, 370);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '16px ' + FONT;
    ctx.fillText('Press R or Enter to get back on the streets.', VIEW_W / 2, 410);
    ctx.textAlign = 'left';
  }

  return { draw: frame };
}
