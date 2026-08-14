import postgres from "postgres";
import { readFileSync } from "fs";
const env = readFileSync("/Users/kiansimonhaess/Desktop/Hussle/Jobsearch/Admin dashboard/.env.local","utf8");
const url = env.match(/DATABASE_URL=(.*)/)[1].trim();
const sql = postgres(url, { prepare: false, max: 1 });
try { console.log(JSON.stringify(await sql.unsafe(process.argv[2]), null, 1)); }
catch(e){ console.error("ERR:", e.message); }
finally { await sql.end(); }
