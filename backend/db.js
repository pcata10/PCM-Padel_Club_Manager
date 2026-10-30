// ════════════════════════════════════════════════════════
//  db.js  —  Local embedded database (@seald-io/nedb)
//  Data is stored in ./data/*.db files (plain JSON lines)
//  No internet, no MongoDB, no installation required.
//
//  @seald-io/nedb already provides native *Async methods:
//    findAsync, findOneAsync, insertAsync, updateAsync,
//    removeAsync, countAsync — all return Promises natively.
// ════════════════════════════════════════════════════════
const Datastore = require("@seald-io/nedb");
const path = require("path");
const fs = require("fs");

// Ensure the data directory exists next to this file
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function mkdb(name) {
  return new Datastore({
    filename: path.join(DATA_DIR, `${name}.db`),
    autoload: true,
  });
}

const db = {
  players:     mkdb("players"),
  tournaments: mkdb("tournaments"),
  courts:      mkdb("courts"),
};

// @seald-io/nedb natively provides *Async methods — no wrappers needed.
// Usage: await db.players.findOneAsync({ email: "..." })
//        await db.players.insertAsync({ name: "..." })
//        await db.tournaments.findAsync({})
//        await db.courts.updateAsync({ _id: id }, { $set: { ... } }, { returnUpdatedDocs: true })
//        await db.players.removeAsync({ _id: id }, {})
//        await db.players.countAsync({})

module.exports = db;
