import type { StatMods, TowerDef, TowerStats, UpgradeDef, UpgradePathDef } from '../sim/types';

/** Tower ids in shop order. */
export const TOWER_ORDER = [
  'blaster', 'gatling', 'sniper', 'frost', 'flamethrower', 'rocket', 'seeker', 'spikes',
  'heli', 'tesla', 'laser', 'mortar', 'toxin', 'saw', 'pulse', 'railgun', 'radar', 'coinfactory',
] as const;

/** Id of a shop tower. */
export type TowerId = (typeof TOWER_ORDER)[number];

const DMG = 'icon-skull';
const RANGE = 'icon-target';
const RATE = 'icon-speed2';
const SEE = 'icon-info';
const COIN = 'icon-coin';
const GEN = 'icon-upgrade';
const SIG = 'icon-star';

function up(name: string, cost: number, description: string, mods: StatMods, icon = GEN): UpgradeDef {
  return { name, cost, description, mods, icon };
}

function path(name: string, t1: UpgradeDef, t2: UpgradeDef, t3: UpgradeDef): UpgradePathDef {
  return { name, tiers: [t1, t2, { ...t3, icon: SIG }] };
}

function stats(s: Partial<TowerStats> & Pick<TowerStats, 'range' | 'cooldown' | 'damage'>): TowerStats {
  return {
    damageType: 'physical', pierce: 1, projectileSpeed: 0, splashRadius: 0,
    canHitStealth: false, canHitFlying: true, ...s,
  };
}

function sprite(id: TowerId, turret = true): TowerDef['sprite'] {
  return turret ? { base: `tower-${id}-base`, turret: `tower-${id}-turret` } : { base: `tower-${id}-base` };
}

/** All towers by id. */
export const TOWERS: Readonly<Record<TowerId, TowerDef>> = {
  blaster: {
    id: 'blaster', name: 'Blaster', category: 'basic', cost: 200, footprint: 26, placement: 'ground',
    description: 'The trusty dart thrower from the old days. Cheap, cheerful, pointy.',
    projectile: { kind: 'dart', motion: 'straight' },
    stats: stats({ range: 260, cooldown: 0.55, damage: 8, projectileSpeed: 900 }),
    paths: [
      path('Piercing Darts',
        up('Sharpened Tips', 80, 'Darts punch through 1 extra parasite.', { add: { pierce: 1 } }),
        up('Barbed Darts', 200, '+2 pierce and +3 damage. Ouch.', { add: { pierce: 2, damage: 3 } }, DMG),
        up('Dart Storm', 600, 'Darts deal double damage and pierce 4 more parasites.', { mul: { damage: 2 }, add: { pierce: 4 } })),
      path('Rapid Fire',
        up('Oiled Springs', 90, 'Fires 25% faster.', { mul: { cooldown: 0.8 } }, RATE),
        up('Long Barrel', 220, '+60 range and darts fly 40% faster.', { add: { range: 60 }, mul: { projectileSpeed: 1.4 } }, RANGE),
        up('Blaster Overdrive', 650, 'Fires twice as fast and darts deal +4 damage.', { mul: { cooldown: 0.5 }, add: { damage: 4 } })),
    ],
    sprite: sprite('blaster'),
  },
  gatling: {
    id: 'gatling', name: 'Gatling', category: 'basic', cost: 400, footprint: 28, placement: 'ground',
    description: 'Many small bullets, very quickly. Struggles against thick shells.',
    projectile: { kind: 'bullet', motion: 'straight' },
    stats: stats({ range: 230, cooldown: 0.12, damage: 5, projectileSpeed: 1100 }),
    paths: [
      path('Spin-Up',
        up('Greased Bearings', 160, 'Fires 18% faster.', { mul: { cooldown: 0.85 } }, RATE),
        up('Belt Feed', 400, 'Fires 25% faster and +30 range.', { mul: { cooldown: 0.8 }, add: { range: 30 } }, RATE),
        up('Bullet Hose', 1200, 'Doubles the fire rate. Pure lead weather.', { mul: { cooldown: 0.5 } })),
      path('Heavy Rounds',
        up('Hollow Points', 180, '+3 damage per bullet.', { add: { damage: 3 } }, DMG),
        up('Armor Piercers', 450, '+5 damage and bullets pierce 1 extra parasite.', { add: { damage: 5, pierce: 1 } }, DMG),
        up('Depleted Pewpew', 1300, 'Doubles bullet damage.', { mul: { damage: 2 } })),
    ],
    sprite: sprite('gatling'),
  },
  sniper: {
    id: 'sniper', name: 'Sniper', category: 'basic', cost: 350, footprint: 26, placement: 'ground',
    description: 'Hits instantly from far away. Slow to reload, never misses.',
    projectile: { kind: 'sniper', motion: 'straight' },
    stats: stats({ range: 650, cooldown: 1.6, damage: 40 }),
    paths: [
      path('Donations',
        up('Little Donation', 140, 'Someone chipped in for better bullets: +20 damage.', { add: { damage: 20 } }, COIN),
        up('Bigger Donation', 380, 'The fundraiser went well: damage x1.8.', { mul: { damage: 1.8 } }, COIN),
        up('Biggest Donation', 1100, 'Turns out the donations were real all along: damage x2.5.', { mul: { damage: 2.5 } })),
      path('Spotter',
        up('Night Vision Scope', 150, 'Can see and shoot stealthy parasites.', { set: { canHitStealth: true } }, SEE),
        up('Bolt Action', 350, 'Fires 43% faster.', { mul: { cooldown: 0.7 } }, RATE),
        up('Satellite Link', 1100, 'Global range: hits anything on the map, and fires 33% faster.', { set: { range: 2000 }, mul: { cooldown: 0.75 } })),
    ],
    sprite: sprite('sniper'),
  },
  frost: {
    id: 'frost', name: 'Frost Cannon', category: 'magic', cost: 400, footprint: 30, placement: 'ground',
    description: 'Lobs icy bursts that chill everything nearby.',
    projectile: { kind: 'frost', motion: 'straight' },
    stats: stats({
      range: 220, cooldown: 1, damage: 4, damageType: 'ice', splashRadius: 60, projectileSpeed: 700,
      slow: { factor: 0.55, duration: 1.5 },
    }),
    paths: [
      path('Permafrost',
        up('Colder Snaps', 160, 'Chilled parasites move 20% slower than before.', { mul: { 'slow.factor': 0.8 } }),
        up('Lingering Chill', 400, 'Chill lasts 1 s longer.', { add: { 'slow.duration': 1 } }),
        up('Absolute Zero', 1200, 'Chilled parasites crawl at a quarter of their chilled speed.', { mul: { 'slow.factor': 0.25 } })),
      path('Ice Shards',
        up('Jagged Ice', 180, '+6 damage.', { add: { damage: 6 } }, DMG),
        up('Wider Blast', 420, '+30 blast radius.', { add: { splashRadius: 30 } }, RANGE),
        up('Glacier Breaker', 1300, 'Triple damage, and shards leave 20 dps frostbite for 2 s.', {
          mul: { damage: 3 }, set: { dot: { dps: 20, duration: 2, type: 'ice' } },
        })),
    ],
    sprite: sprite('frost'),
  },
  flamethrower: {
    id: 'flamethrower', name: 'Flamethrower', category: 'heavy', cost: 550, footprint: 30, placement: 'ground',
    description: 'Short range, lots of fire. Burning parasites keep burning.',
    projectile: { kind: 'flame', motion: 'straight' },
    stats: stats({
      range: 170, cooldown: 0.08, damage: 2, damageType: 'fire', pierce: 3, projectileSpeed: 520,
      dot: { dps: 8, duration: 2, type: 'fire' },
    }),
    paths: [
      path('Heat',
        up('Yellow Hot', 220, 'Burn +6 dps.', { add: { 'dot.dps': 6 } }, DMG),
        up('White Hot', 550, 'Burn damage x1.6 and flames +1 damage.', { mul: { 'dot.dps': 1.6 }, add: { damage: 1 } }, DMG),
        up('Blue Hot', 1650, 'Burn damage doubles and flames pierce 3 more parasites.', { mul: { 'dot.dps': 2 }, add: { pierce: 3 } })),
      path('Fuel',
        up('Longer Nozzle', 200, '+40 range.', { add: { range: 40 } }, RANGE),
        up('Napalm Mix', 500, 'Burns last 2 s longer.', { add: { 'dot.duration': 2 } }),
        up("Dragon's Breath", 1500, '+6 pierce, +40 range and 43% faster flames.', {
          add: { pierce: 6, range: 40 }, mul: { cooldown: 0.7 },
        })),
    ],
    sprite: sprite('flamethrower'),
  },
  rocket: {
    id: 'rocket', name: 'Rocket Launcher', category: 'heavy', cost: 700, footprint: 32, placement: 'ground',
    description: 'Big boom, big radius, big smile.',
    projectile: { kind: 'rocket', motion: 'straight' },
    stats: stats({ range: 320, cooldown: 1.8, damage: 45, damageType: 'explosive', splashRadius: 90, projectileSpeed: 600 }),
    paths: [
      path('Warheads',
        up('Bigger Boom', 280, '+20 damage.', { add: { damage: 20 } }, DMG),
        up('Wide Blast', 700, '+30 explosion radius.', { add: { splashRadius: 30 } }, RANGE),
        up('Bunker Buster', 2100, 'Damage x2.5 and +20 explosion radius.', { mul: { damage: 2.5 }, add: { splashRadius: 20 } })),
      path('Launcher',
        up('Faster Rockets', 250, 'Rockets fly 50% faster and +40 range.', { mul: { projectileSpeed: 1.5 }, add: { range: 40 } }, RANGE),
        up('Auto-Loader', 650, 'Fires 43% faster.', { mul: { cooldown: 0.7 } }, RATE),
        up('Rapid Salvo', 2000, 'Fires 3 times as fast.', { mul: { cooldown: 1 / 3 } })),
    ],
    sprite: sprite('rocket'),
  },
  seeker: {
    id: 'seeker', name: 'Seeker', category: 'heavy', cost: 900, footprint: 32, placement: 'ground',
    description: 'Fires slow homing energy orbs that never give up the chase.',
    projectile: { kind: 'missile', motion: 'homing', homingRadius: 200 },
    stats: stats({ range: 340, cooldown: 1, damage: 30, damageType: 'energy', pierce: 2, projectileSpeed: 380 }),
    paths: [
      path('Payload',
        up('Greater Damage', 360, '+15 damage.', { add: { damage: 15 } }, DMG),
        up('Even Greater Damage', 900, 'Damage x1.6.', { mul: { damage: 1.6 } }, DMG),
        up('One Shot to Rule Them All', 2700, 'Damage x3, but fires 33% slower.', { mul: { damage: 3, cooldown: 1.5 } })),
      path('Swarm',
        up('Faster Energy', 300, 'Orbs fly 40% faster.', { mul: { projectileSpeed: 1.4 } }, RATE),
        up('More Piercing', 800, 'Orbs pass through 2 more parasites.', { add: { pierce: 2 } }),
        up('Hive Launcher', 2600, 'Fires twice as fast and orbs pass through 3 more parasites.', {
          mul: { cooldown: 0.5 }, add: { pierce: 3 },
        })),
    ],
    sprite: sprite('seeker'),
  },
  spikes: {
    id: 'spikes', name: 'Spike Trap', category: 'basic', cost: 150, footprint: 22, placement: 'path',
    behavior: 'trap',
    description: 'Placed on the path. Stabs crawling parasites until it runs out of spikes. Flyers float over it.',
    stats: stats({ range: 30, cooldown: 0.5, damage: 15, canHitFlying: false, canHitStealth: true, charges: 12 }),
    paths: [
      path('Nastier Spikes',
        up('Rusty Nails', 60, '+10 damage per stab.', { add: { damage: 10 } }, DMG),
        up('Bigger Pile', 150, '+10 spikes before it breaks.', { add: { charges: 10 } }),
        up('Iron Maiden', 450, 'Damage x2.5, and stabbed parasites bleed for 10 dps over 3 s.', {
          mul: { damage: 2.5 }, set: { dot: { dps: 10, duration: 3, type: 'physical' } },
        })),
      path('Maintenance',
        up('Spring-Loaded', 60, 'No longer breaks when empty: it rests and refills after each wave.', { flags: ['refill'] }),
        up('Reinforced Plates', 150, '+8 spikes and stabs 25% faster.', { add: { charges: 8 }, mul: { cooldown: 0.8 } }, RATE),
        up('Parting Gift', 450, 'When the last spike breaks, the trap blows up for 8x damage in a 110 px blast.', {
          flags: ['blastOnEmpty'], add: { splashRadius: 110 },
        })),
    ],
    sprite: sprite('spikes', false),
  },
  heli: {
    id: 'heli', name: 'Heli Pad', category: 'heavy', cost: 1200, footprint: 36, placement: 'ground', behavior: 'heli',
    description: 'A gunship that patrols around its pad (or a spot you pick), hunts parasites and hoses them down.',
    projectile: { kind: 'bullet', motion: 'straight' },
    stats: stats({
      range: 240, cooldown: 0.15, damage: 6, projectileSpeed: 1000, shots: 1,
      flight: { speed: 220, turnRate: 3.5, leash: 350 },
    }),
    paths: [
      path('Door Gunner',
        up('Hot Barrels', 480, 'Fires 25% faster.', { mul: { cooldown: 0.8 } }, RATE),
        up('Heavy Miniguns', 1200, '+6 damage per bullet.', { add: { damage: 6 } }, DMG),
        up('Gunship', 3600, 'Damage x2.5, +60 range and a second gun: shoots 2 parasites at once.', {
          mul: { damage: 2.5 }, add: { range: 60, shots: 1 },
        })),
      path('Avionics',
        up('Afterburners', 450, 'Flies 40% faster and hunts 100 px further from its patrol point.', {
          mul: { 'flight.speed': 1.4 }, add: { 'flight.leash': 100 },
        }, RANGE),
        up('FLIR Camera', 900, 'Can spot and shoot stealthy parasites.', { set: { canHitStealth: true } }, SEE),
        up('Hellfire Rockets', 3500, 'Bullets become explosive: 60 px blast and +10 damage.', {
          set: { damageType: 'explosive' }, add: { splashRadius: 60, damage: 10 },
        })),
    ],
    sprite: sprite('heli'),
  },
  tesla: {
    id: 'tesla', name: 'Tesla Coil', category: 'magic', cost: 750, footprint: 30, placement: 'ground', behavior: 'chain',
    description: 'Lightning that jumps from parasite to parasite, weakening a little each jump.',
    stats: stats({
      range: 220, cooldown: 1.1, damage: 30, damageType: 'energy', chain: { jumps: 3, range: 140, falloff: 0.8 },
    }),
    paths: [
      path('Capacitors',
        up('Bigger Coil', 300, '+15 damage.', { add: { damage: 15 } }, DMG),
        up('Arc Reactor', 750, 'Lightning jumps to 2 more parasites.', { add: { 'chain.jumps': 2 } }),
        up('Overload', 2250, 'Double damage, and every zap stuns for 0.4 s.', { mul: { damage: 2 }, add: { stun: 0.4 } })),
      path('Conductors',
        up('Copper Windings', 300, 'Zaps 25% faster and senses stealthy parasites.', {
          mul: { cooldown: 0.8 }, set: { canHitStealth: true },
        }, RATE),
        up('Long Arc', 700, 'Arcs reach 60 px further and keep 10% more power per jump.', {
          add: { 'chain.range': 60, 'chain.falloff': 0.1 },
        }, RANGE),
        up('Storm Caller', 2200, 'Lightning jumps to 6 more parasites and loses only 5% per jump.', {
          add: { 'chain.jumps': 6, 'chain.falloff': 0.05 },
        })),
    ],
    sprite: sprite('tesla'),
  },
  laser: {
    id: 'laser', name: 'Laser Prism', category: 'magic', cost: 1100, footprint: 30, placement: 'ground', behavior: 'beam',
    description: 'A continuous beam that burns hotter the longer it stays on one target.',
    stats: stats({ range: 300, cooldown: 0.1, damage: 4, damageType: 'energy', ramp: { max: 4, time: 3 } }),
    paths: [
      path('Focusing Lens',
        up('Ruby Crystal', 450, '+2 beam damage per tick (+20 dps before ramp).', { add: { damage: 2 } }, DMG),
        up('Thermal Lock', 1100, 'Ramps up to 2 more multiples (4x to 6x) and 20% sooner.', {
          add: { 'ramp.max': 2 }, mul: { 'ramp.time': 0.8 },
        }),
        up('Death Ray', 3300, 'Beam damage x2.5 and the ramp goes 2 multiples higher.', {
          mul: { damage: 2.5 }, add: { 'ramp.max': 2 },
        })),
      path('Prism',
        up('Wide Aperture', 400, '+60 range.', { add: { range: 60 } }, RANGE),
        up('Spectral Sight', 900, 'The beam sees stealthy parasites.', { set: { canHitStealth: true } }, SEE),
        up('Refraction Array', 3000, 'Splits into 3 beams hitting 3 different targets.', { add: { pierce: 2 } })),
    ],
    sprite: sprite('laser'),
  },
  mortar: {
    id: 'mortar', name: 'Mortar', category: 'heavy', cost: 800, footprint: 34, placement: 'ground', behavior: 'lob',
    description: 'Lobs heavy shells across the map. Cannot hit anything that flies.',
    projectile: { kind: 'mortar', motion: 'lob' },
    stats: stats({
      range: 600, cooldown: 2.4, damage: 60, damageType: 'explosive', splashRadius: 100, projectileSpeed: 500,
      canHitFlying: false,
    }),
    paths: [
      path('Shells',
        up('Heavy Shells', 320, '+30 damage.', { add: { damage: 30 } }, DMG),
        up('Wide Blast', 800, '+30 blast radius.', { add: { splashRadius: 30 } }, RANGE),
        up('Thunder Barrage', 2400, 'Fires 2.5 times as fast.', { mul: { cooldown: 0.4 } })),
      path('Artillery',
        up('Quick Reload', 300, 'Fires 25% faster.', { mul: { cooldown: 0.8 } }, RATE),
        up('Incendiary Rounds', 750, 'Shells set parasites ablaze: 20 dps burn for 3 s.', {
          set: { dot: { dps: 20, duration: 3, type: 'fire' } },
        }),
        up('Big Bertha', 2200, 'Damage x2.5, +30 blast radius and +150 range.', {
          mul: { damage: 2.5 }, add: { splashRadius: 30, range: 150 },
        })),
    ],
    sprite: sprite('mortar'),
  },
  toxin: {
    id: 'toxin', name: 'Toxin Sprayer', category: 'magic', cost: 500, footprint: 30, placement: 'ground',
    description: 'Sprays poison globs. Poison ignores armor completely.',
    projectile: { kind: 'toxin', motion: 'straight' },
    stats: stats({
      range: 240, cooldown: 0.7, damage: 4, damageType: 'poison', splashRadius: 50, projectileSpeed: 500,
      dot: { dps: 12, duration: 4, type: 'poison' },
    }),
    paths: [
      path('Potency',
        up('Concentrated Venom', 200, 'Poison +8 dps.', { add: { 'dot.dps': 8 } }, DMG),
        up('Neurotoxin', 500, 'Hit parasites are slowed by 25% for 1.5 s.', { set: { slow: { factor: 0.75, duration: 1.5 } } }),
        up('Plague Bomb', 1500, 'Poison damage x2.5 and +40 splash radius.', {
          mul: { 'dot.dps': 2.5 }, add: { splashRadius: 40 },
        })),
      path('Sprayer',
        up('Wide Nozzle', 200, '+30 splash radius.', { add: { splashRadius: 30 } }, RANGE),
        up('Pressure Pump', 480, 'Sprays 43% faster.', { mul: { cooldown: 0.7 } }, RATE),
        up('Acid Rain', 1400, 'Sprays twice as fast and poison lasts 2 s longer.', {
          mul: { cooldown: 0.5 }, add: { 'dot.duration': 2 },
        })),
    ],
    sprite: sprite('toxin'),
  },
  saw: {
    id: 'saw', name: 'Saw Launcher', category: 'basic', cost: 450, footprint: 30, placement: 'ground', behavior: 'boomerang',
    description: 'Throws spinning saw blades that cut through a crowd and come back for more.',
    projectile: { kind: 'saw', motion: 'boomerang' },
    stats: stats({ range: 260, cooldown: 1.3, damage: 14, pierce: 8, projectileSpeed: 450 }),
    paths: [
      path('Blade',
        up('Serrated Edge', 180, '+6 damage.', { add: { damage: 6 } }, DMG),
        up('Diamond Teeth', 450, 'Damage x1.6 and cuts 4 more parasites per throw.', { mul: { damage: 1.6 }, add: { pierce: 4 } }, DMG),
        up('Buzzkill', 1350, 'Double damage and cuts 12 more parasites per throw.', { mul: { damage: 2 }, add: { pierce: 12 } })),
      path('Launcher',
        up('Longer Throw', 180, '+60 range.', { add: { range: 60 } }, RANGE),
        up('Spring Loader', 420, 'Throws 43% faster.', { mul: { cooldown: 0.7 } }, RATE),
        up('Saw Storm', 1300, 'Throws 3 times as fast.', { mul: { cooldown: 1 / 3 } })),
    ],
    sprite: sprite('saw'),
  },
  pulse: {
    id: 'pulse', name: 'Pulse Generator', category: 'magic', cost: 650, footprint: 32, placement: 'ground', behavior: 'aura',
    description: 'Blasts a ring of energy around itself that shoves parasites back.',
    stats: stats({ range: 150, cooldown: 1.5, damage: 12, damageType: 'energy', knockback: 14, canHitStealth: true }),
    paths: [
      path('Amplitude',
        up('Bigger Bang', 260, '+10 pulse damage.', { add: { damage: 10 } }, DMG),
        up('Wider Ring', 650, '+40 pulse radius.', { add: { range: 40 } }, RANGE),
        up('Shockwave', 1950, 'Pulses knock parasites back 30 px further and stun them for 0.6 s (bosses resist: short stun, no knockback).', {
          add: { knockback: 30, stun: 0.6 },
        })),
      path('Frequency',
        up('Faster Pulses', 250, 'Pulses 25% more often.', { mul: { cooldown: 0.8 } }, RATE),
        up('Resonance', 600, 'Pulses slow parasites by 50% for 1.2 s.', { set: { slow: { factor: 0.5, duration: 1.2 } } }),
        up('Seismic Hammer', 1900, 'Pulses 67% more often with 1.5x damage.', { mul: { cooldown: 0.6, damage: 1.5 } })),
    ],
    sprite: sprite('pulse'),
  },
  railgun: {
    id: 'railgun', name: 'Railgun', category: 'heavy', cost: 1600, footprint: 34, placement: 'ground', behavior: 'line',
    description: 'Charges up, then fires an instant slug that tears through a whole line of parasites, all the way to the edge of the map.',
    projectile: { kind: 'rail', motion: 'straight' },
    stats: stats({ range: 650, cooldown: 3, damage: 180, damageType: 'energy', pierce: 6 }),
    paths: [
      path('Capacitor Bank',
        up('Supercapacitors', 650, '+80 damage.', { add: { damage: 80 } }, DMG),
        up('Magnetic Acceleration', 1600, 'Damage x1.6 and the slug pierces 6 more parasites.', {
          mul: { damage: 1.6 }, add: { pierce: 6 },
        }, DMG),
        up('Planet Cracker', 4800, 'Triple damage.', { mul: { damage: 3 } })),
      path('Targeting Computer',
        up('Coolant Loop', 600, 'Fires 25% faster.', { mul: { cooldown: 0.8 } }, RATE),
        up('Phase Scanner', 1200, 'Sees stealthy parasites.', { set: { canHitStealth: true } }, SEE),
        up('Twin Rails', 4500, 'Fires twice as fast and the slug pierces 10 more parasites.', {
          mul: { cooldown: 0.5 }, add: { pierce: 10 },
        })),
    ],
    sprite: sprite('railgun'),
  },
  radar: {
    id: 'radar', name: 'Radar Dish', category: 'support', cost: 500, footprint: 30, placement: 'ground', behavior: 'support',
    description: 'Reveals stealthy parasites nearby and gives nearby towers +15% range.',
    stats: stats({
      range: 250, cooldown: 1, damage: 0, buff: { range: 0.15, cooldownMul: 1, revealStealth: true, radius: 250 },
    }),
    paths: [
      path('Antenna',
        up('Bigger Dish', 200, '+60 radius.', { add: { range: 60, 'buff.radius': 60 } }, RANGE),
        up('Long-Range Uplink', 500, 'Nearby towers get +25% range (was +15%).', { add: { 'buff.range': 0.1 } }, RANGE),
        up('Spy Satellite', 1500, 'Radius x1.8 and nearby towers get another +10% range.', {
          mul: { range: 1.8, 'buff.radius': 1.8 }, add: { 'buff.range': 0.1 },
        })),
      path('Command Center',
        up('Target Painting', 220, 'Nearby towers fire 11% faster.', { mul: { 'buff.cooldownMul': 0.9 } }, RATE),
        up('Tactical Feed', 550, 'Nearby towers fire another 11% faster.', { mul: { 'buff.cooldownMul': 0.9 } }, RATE),
        up('Overclock Beacon', 1600, 'Nearby towers fire another 18% faster.', { mul: { 'buff.cooldownMul': 0.85 } })),
    ],
    sprite: sprite('radar'),
  },
  coinfactory: {
    id: 'coinfactory', name: 'Coin Factory', category: 'support', cost: 900, footprint: 34, placement: 'ground',
    behavior: 'income',
    description: 'Prints 80 coins every time a wave is cleared. Totally legal.',
    stats: stats({ range: 0, cooldown: 1, damage: 0, income: 80, interest: { rate: 0, cap: 0 } }),
    paths: [
      path('Mass Production',
        up('Night Shift', 360, '+40 coins per wave.', { add: { income: 40 } }, COIN),
        up('Assembly Line', 900, '+80 coins per wave.', { add: { income: 80 } }, COIN),
        up('Gold Rush', 2700, "Doubles the factory's coins per wave.", { mul: { income: 2 } })),
      path('Investment Banking',
        up('Savings Account', 300, 'Earns 2% interest on your bank each wave (max 100).', {
          add: { 'interest.rate': 0.02, 'interest.cap': 100 },
        }, COIN),
        up('Hedge Fund', 800, 'Interest +2% (4% total, max 250).', { add: { 'interest.rate': 0.02, 'interest.cap': 150 } }, COIN),
        up('Stock Market Genius', 2400, 'Interest +3% (7% total, max 600). All factories together pay at most 600 interest per wave.', {
          add: { 'interest.rate': 0.03, 'interest.cap': 350 },
        })),
    ],
    sprite: sprite('coinfactory'),
  },
};
