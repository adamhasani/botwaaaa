/* ╔══════════════════════════════════════════════════════╗
   ║  SQLITE VIA WASM — pengganti better-sqlite3              ║
   ║  [MIGRASI CPU] better-sqlite3 = native binary C++, butuh  ║
   ║  instruksi CPU modern (AVX/SSE4.2). Di CPU virtual lama    ║
   ║  (mis. QEMU tanpa AVX) itu crash "Illegal instruction".    ║
   ║  sql.js = SQLite dicompile ke WebAssembly, dijalankan       ║
   ║  lewat WASM runtime bawaan Node — gak butuh instruksi        ║
   ║  CPU khusus apapun, jalan di CPU manapun.                    ║
   ║                                                                ║
   ║  Wrapper ini meniru API better-sqlite3 (.prepare(sql).run()/   ║
   ║  .all()/.get()) SUPAYA simpananDb.js dan contextRecall.js       ║
   ║  TIDAK PERLU ditulis ulang — cuma import-nya yang ganti.         ║
   ║                                                                    ║
   ║  Beda penting dari better-sqlite3: sql.js itu IN-MEMORY, gak       ║
   ║  otomatis nulis ke disk. Wrapper ini nulis ulang file .sqlite       ║
   ║  ke disk setiap ada .run() yang mengubah data (INSERT/UPDATE/       ║
   ║  DELETE), dengan debounce kecil biar gak nulis berkali-kali          ║
   ║  untuk operasi yang beruntun cepat.                                   ║
   ╚══════════════════════════════════════════════════════╝ */
import initSqlJs from 'sql.js';
import fs from 'fs';

let SQL = null;
let saveTimer = null;

function scheduleSave(rawDb, filePath) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            const data = rawDb.export();
            fs.writeFileSync(filePath, Buffer.from(data));
        } catch (e) {
            console.error('[sqliteWasm] Gagal simpan ke disk:', e.message);
        }
    }, 200); // debounce 200ms — cukup buat nunggu operasi beruntun (mis. loop INSERT) selesai
}

/**
 * Buka (atau bikin baru) database SQLite dari file, via WASM.
 * Return objek dengan API mirip better-sqlite3: .prepare(sql), .exec(sql), .pragma(), .close()
 * PENTING: ini fungsi ASYNC (beda dari better-sqlite3 yang sync) karena load WASM
 * butuh await sekali di awal. Dipanggil sekali saat module di-import (top-level await).
 */
export async function openDb(filePath) {
    if (!SQL) {
        SQL = await initSqlJs();
    }

    let rawDb;
    if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        rawDb = new SQL.Database(fileBuffer);
    } else {
        rawDb = new SQL.Database();
    }

    return {
        // .pragma() no-op — WAL mode gak relevan buat sql.js (in-memory + manual save),
        // dipertahankan biar simpananDb.js gak perlu hapus baris pemanggilannya.
        pragma() {},

        exec(sql) {
            rawDb.run(sql);
            scheduleSave(rawDb, filePath);
        },

        prepare(sql) {
            return {
                run(...params) {
                    rawDb.run(sql, params);
                    scheduleSave(rawDb, filePath);
                    return { changes: rawDb.getRowsModified() };
                },
                all(...params) {
                    const stmt = rawDb.prepare(sql);
                    stmt.bind(params);
                    const rows = [];
                    while (stmt.step()) rows.push(stmt.getAsObject());
                    stmt.free();
                    return rows;
                },
                get(...params) {
                    const stmt = rawDb.prepare(sql);
                    stmt.bind(params);
                    let row = undefined;
                    if (stmt.step()) row = stmt.getAsObject();
                    stmt.free();
                    return row;
                },
            };
        },

        close() {
            clearTimeout(saveTimer);
            const data = rawDb.export();
            fs.writeFileSync(filePath, Buffer.from(data));
            rawDb.close();
        },
    };
}
