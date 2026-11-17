# Sunset Bay

SUNSET BAY is an original open-world crime game built for make.fun's "Make GTA 6"
bounty (gta6-01). You play Jax Marlow, fresh out of the Bayview lockup and in debt
to the wrong people, in a sun-soaked coastal city you can explore on foot and by car.

Everything here is original — the city of Sunset Bay, its people, cars, story and
missions are invented for this game. Nothing is taken from any commercial game.

## The game

- **A living coastal city** — a 12x12 block grid of warm-coloured buildings with
  lit windows, roads and sidewalks, palm-lined beaches and an ocean on the south
  edge, parks, streetlights and props, all under a low golden sun.
- **On foot and by car** — third-person on-foot controls with a mouse-orbit camera,
  running and jumping; steal any parked or traffic car and drive it with arcade
  handling, steering, braking and a handbrake. Four car types: sedan, taxi, truck
  and the Vortex GT sports car.
- **Traffic and pedestrians** — cars cruise the road lanes, pedestrians walk the
  sidewalks, and the Sunset Bay PD patrols in black-and-white cruisers.
- **Wanted level** — stealing a car or hitting a pedestrian raises your stars and
  the cruisers chase you. Stay clean and the heat cools off; get caught and you
  are BUSTED, lose cash and walk free again.
- **Missions and story** — a job chain for Rico Vega: meet him at the Marina, steal
  a car for the Harbor Garage, run a package across Sunset Plaza. A golden beacon
  marks each job and finishing one pays cash.
- **HUD and minimap** — cash, health, wanted stars, the in-game clock, the current
  objective, a speedometer while driving, and a live top-down minimap with roads,
  your arrow, the mission marker and police dots.
- **Save** — progress (cash, missions, position, clock) saves to localStorage, with
  a Continue button on the title screen.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## Controls

- **WASD** — move / drive
- **Mouse** — look (click the game to lock the pointer)
- **E** — enter / exit a car (steal it)
- **Shift** — run
- **Space** — jump on foot / handbrake while driving
- **F** — punch
- **R** — show the current mission
- **P** — pause, **M** — mute

## Tech

Plain static files under `game/` — no build step, no network requests at runtime.
Three.js is vendored as a minified ES-module build under `game/vendor/`. The game
source is split by job: `city.js`, `player.js`, `vehicles.js`, `traffic.js`,
`hud.js`, `save.js`, `shots.js`, `main.js`. Screenshot staging modes
(`?shot=start|street|drive|chase`) render composed scenes with no input.

## License

MIT — see LICENSE.
