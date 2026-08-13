import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const plugins = new Map();

// ─────────────────────────────────────────────
// Load semua plugin
// ─────────────────────────────────────────────
export async function loadPlugins(rootDir) {
    const pluginDir = path.join(rootDir, 'plugins');
    const files = getAllFiles(pluginDir);

    plugins.clear();
    let loaded = 0;

    for (const file of files) {
        if (!file.endsWith('.js')) continue;
        await loadSinglePlugin(file);
        loaded++;
    }

    console.log(chalk.green(`[LOADER] ${loaded} plugin berhasil dimuat`));
    startWatcher(pluginDir);
    return plugins;
}

// ─────────────────────────────────────────────
// Load / reload 1 plugin
// ─────────────────────────────────────────────
async function loadSinglePlugin(file) {
    try {
        const mod    = await import(`file://${file}?t=${Date.now()}`);
        const plugin = mod.default;
        if (!plugin?.command || !plugin?.run) return;

        const commands = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
        for (const cmd of commands) {
            plugins.set(cmd.toLowerCase(), plugin);
        }
        return true;
    } catch (e) {
        console.error(chalk.red(`[LOADER] Gagal load ${path.basename(file)}: ${e.message}`));
        return false;
    }
}

// ─────────────────────────────────────────────
// Hot reload watcher — deteksi perubahan file
// ─────────────────────────────────────────────
function startWatcher(pluginDir) {
    fs.watch(pluginDir, { recursive: true }, async (event, filename) => {
        if (!filename?.endsWith('.js')) return;

        const fullPath = path.join(pluginDir, filename);

        // Tunggu sebentar biar file selesai ditulis
        await new Promise(r => setTimeout(r, 200));

        if (!fs.existsSync(fullPath)) {
            // File dihapus — remove dari map
            for (const [cmd, plugin] of plugins.entries()) {
                const pluginFile = plugin._file;
                if (pluginFile === fullPath) plugins.delete(cmd);
            }
            console.log(chalk.yellow(`[LOADER] 🗑️  Plugin dihapus: ${filename}`));
            return;
        }

        const ok = await loadSinglePlugin(fullPath);
        if (ok) {
            console.log(chalk.cyan(`[LOADER] 🔄 Hot reload: ${filename}`));
        }
    });

    console.log(chalk.gray('[LOADER] 👁️  Watching plugin changes...'));
}

// ─────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────
function getAllFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    let results = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
            results = results.concat(getAllFiles(full));
        } else {
            results.push(full);
        }
    }
    return results;
}

export { plugins };
