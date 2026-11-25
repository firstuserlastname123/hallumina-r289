// Read-only: use the original loader and packed definitions, never save().
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const engine = process.cwd();
const username = process.argv[2];
assert(/^[a-z0-9_]{1,12}$/.test(username), 'Supply a normalized disposable username.');
const moduleAt = relative => import(pathToFileURL(`${engine}/src/${relative}.ts`));
const { default: InvType } = await moduleAt('cache/config/InvType');
const { default: VarPlayerType } = await moduleAt('cache/config/VarPlayerType');
const { default: ObjType } = await moduleAt('cache/config/ObjType');
const { default: Packet } = await moduleAt('io/Packet');
const { PlayerLoading } = await moduleAt('engine/entity/PlayerLoading');
InvType.load('data/pack');
VarPlayerType.load('data/pack');
ObjType.load('data/pack');
const raw = fs.readFileSync(`data/players/main/${username}.sav`);
assert(PlayerLoading.verify(new Packet(raw)), 'Save checksum invalid.');
const player = PlayerLoading.load(username, new Packet(raw), null);
const output = JSON.stringify({
    location: { x: player.x, z: player.z, level: player.level },
    xpTenths: [...player.stats], levels: [...player.baseLevels],
    tutorial: player.vars[VarPlayerType.getId('tutorial')],
    permanentVars: Object.fromEntries([...player.vars.entries()].filter(([id]) => VarPlayerType.get(id)?.scope === VarPlayerType.SCOPE_PERM).map(([id, value]) => [VarPlayerType.get(id).debugname ?? id, value])),
    inventories: Object.fromEntries([...player.invs].map(([id, inv]) => [InvType.get(id).debugname ?? id, inv.items.map(item => item && { ...item, name: ObjType.get(item.id).debugname })])),
    playtime: player.playtime
}, null, 2);
// World is imported by the native Player class and owns idle worker threads.
// No World.start() is called; close this read-only tool after printing its result.
process.stdout.write(output + '\n', () => process.exit(0));
