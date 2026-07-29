// scraper.js
// TOP LEVEL agora vem da API OFICIAL do Wartale (dados exatos: exp, % e clã).
// Os rankings secundários (mineração, pesca, pvp) continuam vindo do HTML
// público do site, porque não tínhamos a documentação confirmada da API pra eles.
// Grava tudo em data/history.json e avisa no Discord (se configurado) quando
// alguém sobe de nível.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const HISTORY_PATH = path.join(__dirname, "data", "history.json");
const CLASS_MAP = JSON.parse(fs.readFileSync(path.join(__dirname, "class-map.json"), "utf-8"));

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const WARTALE_API_BASE_URL = process.env.WARTALE_API_BASE_URL || ""; // ex: https://wartale.com
const WARTALE_API_KEY = process.env.WARTALE_API_KEY || "";

// Quantos personagens buscar no Top Level (a API pode ter um teto interno;
// se `count` for maior que o permitido, ela deve simplesmente devolver o máximo).
const TOP_LEVEL_COUNT = 500;

// ---------------------------------------------------------------------------
// TOP LEVEL — via API oficial (v1)
// ---------------------------------------------------------------------------
async function fetchTopLevelFromApi() {
  if (!WARTALE_API_BASE_URL || !WARTALE_API_KEY) {
    throw new Error(
      "WARTALE_API_BASE_URL e/ou WARTALE_API_KEY não configurados (veja o README, seção 'Configurar a API oficial')."
    );
  }
  const url =
    `${WARTALE_API_BASE_URL}/api.asp` +
    `?key=${encodeURIComponent(WARTALE_API_KEY)}` +
    `&action=ranking_top_level&league=0&count=${TOP_LEVEL_COUNT}&class=0`;

  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; WartaleTrackerBot/1.0)" } });
  if (!res.ok) throw new Error(`API Top Level respondeu HTTP ${res.status}`);
  const data = await res.json();
  const results = data.results || data.data || data; // tolera pequenas variações de formato
  if (!Array.isArray(results)) throw new Error("Formato de resposta inesperado da API Top Level.");

  return results.map((r) => ({
    name: r.name,
    level: r.level,
    exp: r.exp,
    expPercentage: r.expPercentage,
    class: CLASS_MAP[String(r.class)] || `Classe #${r.class}`,
    clanId: r.clanId || null,
    clanName: r.clanName || null,
    clanSlogan: r.clanSlogan || null,
    clanIconUrl: r.clanId ? `https://user.wartale.com/clanicons/${r.clanId}.png` : null,
  }));
}

// ---------------------------------------------------------------------------
// Rankings secundários — via HTML público (mineração, pesca, pvp)
// ---------------------------------------------------------------------------
const HTML_RANKING_SOURCES = [
  { id: "mining", label: "Mineração", url: "https://wartale.com/ranking/block_top_mining.php" },
  { id: "fishing", label: "Pesca", url: "https://wartale.com/ranking/block_top_fishing.php" },
  { id: "pvp", label: "PvP Individual", url: "https://wartale.com/ranking/block_pvp_personal.php" },
];

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; WartaleTrackerBot/1.0)" } });
  if (!res.ok) throw new Error(`Falha ao buscar ${url}: HTTP ${res.status}`);
  return res.text();
}

function parseRankingTable(html) {
  const $ = cheerio.load(html);
  const rows = [];

  $("tr").each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length === 0) return;

    let className = null;
    let clanIconUrl = null;
    let name = null;
    let value = null;

    tds.each((j, td) => {
      const $td = $(td);
      const img = $td.find("img").first();
      const src = img.attr("src") || "";

      if (img.length && src.includes("/portraits/")) {
        className = (img.attr("alt") || img.attr("title") || "").trim();
        return;
      }
      if (img.length && src.includes("/clanicons/")) {
        clanIconUrl = src.startsWith("http") ? src : `https://user.wartale.com${src}`;
        return;
      }

      const text = $td.text().trim();
      if (!text) return;

      if (/^[\d,]+$/.test(text) && !/^\d+\.$/.test(text)) {
        value = parseInt(text.replace(/,/g, ""), 10);
        return;
      }
      if (/^\d+\.$/.test(text)) return;
      if (!name) name = text;
    });

    if (name && value !== null) {
      if (clanIconUrl && clanIconUrl.endsWith("/0.png")) clanIconUrl = null;
      rows.push({ name, class: className || "Desconhecida", clanIconUrl, value });
    }
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------
function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) {
    return { characters: {}, rankings: {}, updatedAt: null };
  }
  const data = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));
  if (!data.rankings) data.rankings = {};
  return data;
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");
}

function upsertEntry(bucket, key, meta, today, computeGain) {
  if (!bucket[key]) bucket[key] = { ...meta, history: [] };
  const entry = bucket[key];
  Object.assign(entry, meta); // sempre atualiza classe/clã/etc pro valor mais recente

  const h = entry.history;
  const todayIndex = h.findIndex((x) => x.date === today);
  const priorEntries = todayIndex === -1 ? h : h.slice(0, todayIndex);
  const baseline = priorEntries[priorEntries.length - 1];

  const { gain, todayEntry } = computeGain(baseline);

  if (todayIndex !== -1) h[todayIndex] = todayEntry;
  else h.push(todayEntry);

  if (h.length > 60) entry.history = h.slice(-60);

  return { baseline, gain };
}

async function postDiscordMessage(content) {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch (e) {
    console.error("Falha ao enviar mensagem pro Discord:", e.message);
  }
}

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  const history = loadHistory();
  const levelUpEvents = [];

  // --- Top Level via API oficial ---
  try {
    const chars = await fetchTopLevelFromApi();
    for (const c of chars) {
      const { baseline, gain } = upsertEntry(
        history.characters,
        c.name,
        { class: c.class, clanIconUrl: c.clanIconUrl, clanName: c.clanName, clanSlogan: c.clanSlogan },
        today,
        (baseline) => {
          const g = baseline ? +((c.exp - baseline.exp) / 1e12).toFixed(3) : 0;
          return {
            gain: Math.max(0, g),
            todayEntry: { date: today, level: c.level, exp: c.exp, expPercentage: c.expPercentage, triGain: Math.max(0, g) },
          };
        }
      );
      if (baseline && c.level > baseline.level) {
        levelUpEvents.push(`🎉 **${c.name}** (${c.class}) subiu para o nível **${c.level}**! (+${gain.toFixed(3)} tri)`);
      }
    }
    console.log(`[toplevel] ok — ${chars.length} personagens (API oficial).`);
  } catch (e) {
    console.error("[toplevel] erro ao buscar da API oficial:", e.message);
  }

  // --- Rankings secundários via HTML público ---
  for (const source of HTML_RANKING_SOURCES) {
    try {
      const html = await fetchHtml(source.url);
      const rows = parseRankingTable(html);
      if (rows.length === 0) {
        console.error(`[${source.id}] nenhuma linha encontrada — a página pode ter mudado.`);
        continue;
      }
      if (!history.rankings[source.id]) history.rankings[source.id] = { label: source.label, entries: {} };
      history.rankings[source.id].label = source.label;

      for (const char of rows) {
        upsertEntry(
          history.rankings[source.id].entries,
          char.name,
          { class: char.class, clanIconUrl: char.clanIconUrl },
          today,
          (baseline) => {
            const g = baseline ? Math.max(0, char.value - baseline.value) : 0;
            return { gain: g, todayEntry: { date: today, value: char.value, gain: g } };
          }
        );
      }
      console.log(`[${source.id}] ok — ${rows.length} registros (HTML público).`);
    } catch (e) {
      console.error(`[${source.id}] erro ao buscar:`, e.message);
    }
  }

  history.updatedAt = new Date().toISOString();
  saveHistory(history);

  if (levelUpEvents.length > 0) {
    await postDiscordMessage([`📜 **Atualização do Ledger de Ascensão** (${today})`, ...levelUpEvents].join("\n"));
  }

  console.log(`Coleta finalizada em ${today}.`);
}

run().catch((err) => {
  console.error("Erro ao rodar o scraper:", err);
  process.exit(1);
});
