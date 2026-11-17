// Story: Jax Marlow's six-job chain across Sunset Bay. Each job has a
// giver, dialogue lines shown on screen, an objective target, a cash
// reward and a trigger (drive-by, gunfight, heat) the game wires up.
import { BEACH_Z } from './city.js';

export const MISSIONS = [
  {
    giver: 'Rico Vega',
    text: 'Meet Rico at the Marina.',
    dialogue: 'RICO: Jax! You made it out. I got work — real work. Meet me at the Marina pier, no cops.',
    target: { x: 60, z: BEACH_Z + 16 },
    reward: 400,
    trigger: 'walk',
  },
  {
    giver: 'Rico Vega',
    text: 'Steal a car and bring it to the Harbor Garage.',
    dialogue: 'RICO: First job — I need wheels. Lift something fast, bring it to the Harbor Garage. Quietly.',
    target: { x: -120, z: -120 },
    reward: 600,
    trigger: 'drive',
  },
  {
    giver: 'Mara Quinn',
    text: 'Deliver the package to Sunset Plaza.',
    dialogue: 'MARA: Package is hot, courier. Sunset Plaza, middle of the square. Do not open it. Do not stop.',
    target: { x: 0, z: 0 },
    reward: 800,
    trigger: 'walk',
  },
  {
    giver: 'Rico Vega',
    text: 'Gunfight at the Docks — clear out the Dock Rats.',
    dialogue: 'RICO: The Dock Rats took my shipment. They are armed — so are you now. Click to shoot, R to reload. Clear them out!',
    target: { x: -150, z: 150 },
    reward: 1000,
    trigger: 'combat',
  },
  {
    giver: 'Mara Quinn',
    text: 'HEAT! Lose the SBPD and reach the Safehouse.',
    dialogue: 'MARA: The whole SBPD is coming down on you — roadblocks, chopper, everything. Drive to the Safehouse and lay low!',
    target: { x: 150, z: -150 },
    reward: 1200,
    trigger: 'heat',
  },
  {
    giver: 'Rico Vega',
    text: 'The Sunset Heist — hit the Bay Bank and get out.',
    dialogue: 'RICO: One last job, Jax. The Bay Bank, dawn. Grab the cash, dodge the chopper, and we are free. Make it count.',
    target: { x: -60, z: -60 },
    reward: 2000,
    trigger: 'heist',
  },
];

export const FINALE = {
  giver: 'Rico Vega',
  text: 'Lay low. You own this city — for now.',
  dialogue: 'RICO: Six jobs, clean getaway. Sunset Bay is yours, Jax. The tide is finally on our side.',
  target: null,
  reward: 0,
  trigger: 'done',
};

/** The mission at an index, falling back to the finale once the chain ends. */
export function missionAt(index) {
  return index < MISSIONS.length ? MISSIONS[index] : FINALE;
}

export function missionCount() {
  return MISSIONS.length;
}
