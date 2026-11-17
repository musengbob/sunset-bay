// Deterministic ?shot= staging for screenshots. Each mode sets camera, player /
// car state and HUD so a plain page load renders a composed scene with no input:
//   ?shot=start  — title screen over the city at golden hour
//   ?shot=street — on foot in a busy street, traffic + pedestrians around
//   ?shot=drive  — driving a sports car, HUD + minimap + speed visible
//   ?shot=chase  — police chase, wanted stars visible, cruisers on your tail

export function stageShot(mode, ctx) {
  const { player, vehicles, traffic, hud, setState } = ctx;
  if (mode === 'start') {
    // High wide shot over downtown toward the beach; title screen stays up.
    player.teleport(0, 120, Math.PI);
    ctx.camera.position.set(-40, 55, 190);
    ctx.camera.lookAt(0, 8, 40);
    ctx.lockCamera = true;
    setState({ screen: 'title', wanted: 0, cash: 250, health: 100, clockMinutes: 18 * 60 + 42 });
    return;
  }
  if (mode === 'street') {
    // Stand on the sidewalk (clear of parked cars on the road) looking west
    // down the street, with traffic and pedestrians around.
    player.teleport(-6, 38, Math.PI * 0.5);
    traffic.stageBusy(10, 30);
    setState({ screen: 'playing', wanted: 0, cash: 250, health: 100, clockMinutes: 17 * 60 + 5 });
    hud.showToast('Downtown Sunset Bay — press E near a car to steal it', 60000);
    return;
  }
  if (mode === 'drive') {
    // The teal Vortex GT parked by the marina, not a random repaint.
    const car = vehicles.cars.find((c) => c.def.name === 'Vortex GT' && Math.abs(c.pos.x - 54) < 1)
      || vehicles.cars.find((c) => c.def.name === 'Vortex GT') || vehicles.cars[0];
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
    const car = vehicles.cars.find((c) => c.def.name === 'Vortex GT' && Math.abs(c.pos.x - 54) < 1)
      || vehicles.cars.find((c) => c.def.name === 'Vortex GT') || vehicles.cars[0];
    car.pos.set(0, 0, 60);
    car.heading = Math.PI;
    car.speed = 22;
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;
    vehicles.enterCar(car);
    player.teleport(0, 60, Math.PI);
    traffic.stageChase({ x: 0, z: 60 }, Math.PI);
    setState({ screen: 'playing', wanted: 3, cash: 1250, health: 82, clockMinutes: 19 * 60 + 8 });
    hud.showToast('WANTED — Lose the SBPD!', 60000);
    return;
  }
  // Unknown shot: fall back to the title screen.
  stageShot('start', ctx);
}
