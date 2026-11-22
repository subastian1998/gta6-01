# Solmar Bay — Sun, Sand & Sirens

An original open-world crime game in the browser, built for make.fun's
gta6-01 competition. No libraries, no network requests, no borrowed names:
vanilla JavaScript + canvas 2D, all sound synthesised with WebAudio.

## The game

Mara Voss, 28, drove delivery vans until the company folded. Now she runs
jobs for Dario Kestrel, a fixer working out of a garage in Old Town — and
for Lena Sol, who lifts ledgers from the Strip. Six story jobs take her
across Solmar Bay, a sun-soaked coastal city of her own invention: Marina
Bay, Old Town, the neon Strip, the Harbor District and leafy Uptown.

- **A city to explore** — 3200×2400 of avenues, streets, parks, parking
  lots, a beach with umbrellas and a pier, a harbour with cranes, and a
  lighthouse. Traffic drives the road grid; pedestrians stroll, idle and
  flee when trouble starts.
- **Cars to steal and drive** — seven invented models (Pinto, Comet,
  Solstice, Aurora GT "Sun Chaser", Marlin Cab…). Walk up to any car and
  press E. Arcade handling: throttle, steering, handbrake slides, off-road
  drag, damage and smoke.
- **A wanted level** — 0–5 stars. Stealing, hitting pedestrians and
  shooting raise the heat; the Solmar Bay PD answers with interceptor cars
  that ram and block, and foot officers who chase you down. Lose them by
  breaking away and staying quiet, or get Busted.
- **Missions + story** — six jobs with staged objectives, timers, a heat
  goal and a survival goal, markers on the map and minimap, cash rewards.
- **Combat** — mouse aim, click to shoot. Cops shoot back when you're
  wanted and close. Health regenerates slowly; at zero you're Wasted.
- **HUD with minimap** — cash, health, wanted stars, district + clock,
  mission objective, speedometer and car health, live minimap with the
  mission marker, police blips and viewport.
- **Start screen, pause, save** — progress (money, jobs done, position)
  saves to localStorage automatically and continues on the next visit.

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static HTTP server and open `index.html`.
Desktop Chrome, keyboard + mouse. No build step, no install.

## How to play

| Key | Action |
| --- | ------ |
| WASD / arrows | Move on foot / drive |
| Shift | Sprint |
| E | Steal / enter a car, exit a car |
| Mouse + click | Aim and shoot (on foot) |
| Space | Handbrake |
| M | Start the next job |
| P / Esc | Pause |
| R / Enter | Get back on the streets after Busted / Wasted |

Pick up cash ($), health (+) and wrenches (W) scattered around the city.
Getting Busted or Wasted costs $200 bail / hospital fees.

## Screenshots

`?shot=1` title over a living city · `?shot=2` driving the Aurora GT down
the Strip · `?shot=3` a three-star police chase with a job running ·
`?shot=4` on foot at the Harbor docks, the heist job live. Each shot is a
real frame of the game, simulated with the same rules as play.

## Files

- `game/index.html` — the page, one canvas
- `game/src/config.js` — tuning, palette, districts
- `game/src/city.js` — the map: roads, buildings, parks, landmarks
- `game/src/vehicles.js` — car models, traffic AI, driving physics
- `game/src/pedestrians.js` — the crowd
- `game/src/police.js` — the wanted system and the SBPD
- `game/src/missions.js` — the six story jobs
- `game/src/combat.js` — shooting, bullets, cop fire
- `game/src/audio.js` — synthesised sound: engine, siren, shots, jingles
- `game/src/input.js` — keyboard + mouse
- `game/src/render.js` — world, cars, people, HUD, minimap, menus
- `game/src/save.js` — localStorage save / continue
- `game/src/shots.js` — the four screenshot scenes
- `game/src/main.js` — boot, the fixed-step loop, screens

## License

MIT — see `LICENSE`.
