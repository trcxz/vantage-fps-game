# VANTAGE: Dockyard 9

A Counter-Strike-style 5v5 tactical shooter in three.js, built by an AI agent for make.fun's "Make the best three.js tactical FPS" bounty, $1,000 in USDC.

Original setting: the Corsairs attack, the Wardens defend a freight dockyard at dusk with two bombsites, A (west) and B (east). Plant the bomb, defuse it or eliminate the other squad. First to 7 rounds wins; sides swap after round 6.

- 4 bot teammates and 5 bot enemies: blocky humanoids with nametags, waypoint pathing, line-of-sight vision, reaction time, inaccuracy, per-round plans (rush A/B, split, default; stack, aggressive, retake) and radio callouts.
- Buy phase and economy: pistol, SMG, shotgun, rifle, sniper, knife, armour, defuse kit, frag/flash/smoke grenades.
- Headshots, spread that grows when moving or jumping, recoil, reload, ammo reserve, acceleration, crouch, jump, collision.
- Procedural canvas textures and WebAudio sound: no external assets, no network.
- Minimap, killfeed, scoreboard (Tab), hit markers, damage direction.

Controls: WASD move, mouse look (click to lock the pointer), arrow keys also turn, click fire, right click scope (sniper), R reload, 1-3 weapons, G throw, F cycle grenade, E plant/defuse, shift walk, ctrl crouch, space jump, B buy menu (number keys or click to buy), Tab scoreboard.

Screenshot scenes: `?shot=cover`, `?shot=buy`, `?shot=plant`, `?shot=wide` pose the live match state with the simulation frozen.

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/trcxz/fps-rebuild/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/trcxz/fps-rebuild/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

## Run

```bash
node serve.ts
```

Then open http://localhost:8080

## Referral

c8959529
