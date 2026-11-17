// Deterministic ?shot= staging for screenshots. Each mode sets camera, player /
// car state and HUD so a plain page load renders a composed scene with no input:
//   ?shot=start   — title screen over the city at golden hour
//   ?shot=chase   — 4-star police pursuit: heli + searchlight, roadblock, cruisers
//   ?shot=mission — mission 4 at the Docks: dialogue on screen, gunmen, beacon
//   ?shot=combat  — firefight: auto-firing pistol, tracers, armed gunmen
//   ?shot=drive   — driving a sports car, HUD + minimap + speed visible

function vortexGT(vehicles) {
  return vehicles.cars.find((c) => c.def.name === 'Vortex GT' && Math.abs(c.pos.x - 54) < 1)
    || vehicles.cars.find((c) => c.def.name === 'Vortex GT') || vehicles.cars[0];
}

export function stageShot(mode, ctx) {
  const { player, vehicles, traffic, hud, setState, combat, police } = ctx;
  if (mode === 'start') {
    // High wide shot over downtown toward the beach; title screen stays up.
    player.teleport(0, 120, Math.PI);
    ctx.camera.position.set(-40, 55, 190);
    ctx.camera.lookAt(0, 8, 40);
    ctx.lockCamera = true;
    setState({ screen: 'title', wanted: 0, cash: 250, health: 100, clockMinutes: 18 * 60 + 42 });
    return;
  }
  if (mode === 'mission') {
    // Mission 4, the Docks gunfight: Jax on foot on the road south of the
    // Docks, facing north — three armed Dock Rats and the golden mission
    // beacon straight ahead, Rico's dialogue on screen.
    player.teleport(-150, 168, 0);
    if (combat) combat.spawnSquad(-150, 150, 3);
    traffic.stageBusy(-150, 150);
    setState({ screen: 'playing', wanted: 1, cash: 1850, health: 92, clockMinutes: 19 * 60 + 40, missionIndex: 3 });
    hud.showDialogue('Rico Vega', 'RICO: The Dock Rats took my shipment. They are armed — so are you now. Click to shoot, R to reload. Clear them out!', 60000);
    hud.showToast('MISSION 4 — Gunfight at the Docks', 60000);
    return;
  }
  if (mode === 'combat') {
    // Firefight on a downtown street: gunmen closing in, Jax auto-firing his
    // pistol (the loop fires every 0.45 s in this mode), tracers in the air.
    player.teleport(-6, 38, Math.PI * 0.5);
    player.state.camDist = 11; // pull back so the pistol tracers read in frame
    if (combat) combat.spawnSquad(-22, 38, 3);
    traffic.stageBusy(10, 30);
    setState({ screen: 'playing', wanted: 2, cash: 2650, health: 78, clockMinutes: 20 * 60 + 12, missionIndex: 3 });
    hud.showToast('Dock Rats incoming — Click to shoot!', 60000);
    return;
  }
  if (mode === 'drive') {
    // The teal Vortex GT parked by the marina, not a random repaint.
    const car = vortexGT(vehicles);
    car.pos.set(0, 0, 90);
    car.heading = Math.PI; // north, into the city
    car.speed = 18;
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;
    vehicles.enterCar(car);
    player.teleport(0, 90, Math.PI);
    traffic.stageBusy(0, 40);
    setState({ screen: 'playing', wanted: 0, cash: 410, health: 100, clockMinutes: 18 * 60 + 20 });
    hud.showToast('Vortex GT — 62 mph down Bayfront Ave', 60000);
    return;
  }
  if (mode === 'chase') {
    // Full 4-star pursuit, staged on the open beach so nothing hides the
    // action: the Vortex GT speeding east along the sand, SBPD cruisers
    // closing in head-on, a roadblock ahead, the heli and its searchlight
    // overhead, four wanted stars on the HUD.
    const car = vortexGT(vehicles);
    car.pos.set(-60, 0, 200);
    car.heading = Math.PI / 2;
    car.speed = 22;
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;
    vehicles.enterCar(car);
    player.teleport(-60, 200, Math.PI / 2);
    // Cruisers head-on ahead of the car, so they are in the chase camera's frame.
    const fx = Math.sin(Math.PI / 2);
    const fz = Math.cos(Math.PI / 2);
    traffic.police.forEach((cop, i) => {
      const ahead = 26 + i * 9;
      const lat = i % 2 === 0 ? -4 : 4;
      cop.pos.set(-60 + fx * ahead - fz * lat, 0, 200 + fz * ahead + fx * lat);
      cop.heading = Math.PI / 2 + Math.PI;
      cop.speed = 18;
      cop.group.position.copy(cop.pos);
      cop.group.rotation.y = cop.heading;
    });
    if (police) police.stagePursuit({ x: -60, z: 200 }, Math.PI / 2);
    setState({ screen: 'playing', wanted: 4, cash: 3050, health: 82, clockMinutes: 19 * 60 + 8 });
    hud.showToast('WANTED ★★★★ — Lose the SBPD chopper!', 60000);
    return;
  }
  // Unknown shot: fall back to the title screen.
  stageShot('start', ctx);
}
