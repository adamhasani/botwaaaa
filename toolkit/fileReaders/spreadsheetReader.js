/* ╔══════════════════════════════════════════╗
   ║  SPREADSHEET READER                         ║
   ║  Ekstrak isi .xlsx/.xls/.csv pakai SheetJS  ║
   ╚══════════════════════════════════════════╝ */
import * as XLSX from 'xlsx';

/**
 * Ekstrak isi spreadsheet jadi ringkasan teks per sheet (format CSV-ish,
 * dipotong biar gak kepanjangan buat dikirim balik ke chat / diringkas AI).
 * @param {Buffer} buffer - isi file spreadsheet mentah
 * @param {number} maxRowsPerSheet - batas baris yang diekstrak per sheet
 * @param {number} maxChars - batas panjang total teks yang dikembalikan
 * @returns {{ sheets: {name: string, rowCount: number, preview: string}[], text: string, error: string|null }}
 */
export function extractSpreadsheetData(buffer, maxRowsPerSheet = 50, maxChars = 6000) {
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });

        if (!workbook.SheetNames.length) {
            return { sheets: [], text: null, error: 'File spreadsheet tidak punya sheet apapun.' };
        }

        const sheets = workbook.SheetNames.map((name) => {
            const sheet = workbook.Sheets[name];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            const rowCount = rows.length;
            const limited = rows.slice(0, maxRowsPerSheet);
            const preview = limited.map(r => r.join(' | ')).join('\n');
            return { name, rowCount, preview };
        });

        let text = sheets
            .map(s => `Sheet "${s.name}" (${s.rowCount} baris${s.rowCount > maxRowsPerSheet ? `, ditampilkan ${maxRowsPerSheet} pertama` : ''}):\n${s.preview}`)
            .join('\n\n');
        text = text.slice(0, maxChars);

        return { sheets, text, error: null };
    } catch (e) {
        return { sheets: [], text: null, error: `Gagal baca spreadsheet: ${e.message}` };
    }
}
