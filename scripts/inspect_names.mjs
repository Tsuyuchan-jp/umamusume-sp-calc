import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(
  "D:/DMM/umamusumeDMM/Umamusume/umamusume_Data/Persistent/master/master.mdb",
  { readOnly: true }
);

const ids = [30289, 30010, 30166]; // forever young, fine motion?, tap dance?
for (const id of ids) {
  const rows = db
    .prepare('SELECT category, "index", text FROM text_data WHERE "index" = ? AND category IN (75,76,77,5,4)')
    .all(id);
  console.log("id", id, rows);
}

// search by text
for (const q of ["ノスタルジア", "怒濤", "Innovator", "Zirkus", "白に至る", "永久の誓い", "刀光"]) {
  const rows = db
    .prepare('SELECT category, "index", text FROM text_data WHERE text LIKE ? LIMIT 10')
    .all(`%${q}%`);
  console.log(q, rows);
}

db.close();
