import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(
  "D:/DMM/umamusumeDMM/Umamusume/umamusume_Data/Persistent/master/master.mdb",
  { readOnly: true }
);

for (const q of [
  "一杯のノスタルジア",
  "その執念は怒濤",
  "全てに挑む",
  "ゆかし、きらめき",
  "心覚えし",
  "天才的ユートピア",
  "GRMAラーメン",
]) {
  const rows = db
    .prepare('SELECT category, "index", text FROM text_data WHERE text LIKE ? AND category IN (75,150) LIMIT 5')
    .all(`%${q}%`);
  console.log(q, rows);
}

db.close();
