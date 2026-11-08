const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const HTML = path.join(ROOT, "index.html");
let failures = 0;
let pending = 0;

function check(name, fn) {
  pending++;
  Promise.resolve()
    .then(() => fn())
    .then(detail => {
      pending--;
      console.log(`PASS  ${name}${detail ? " — " + detail : ""}`);
    })
    .catch(err => {
      pending--;
      failures++;
      console.error(`FAIL  ${name} — ${err.message}`);
    });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const html = fs.readFileSync(HTML, "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch, "aucun bloc <script> trouvé");
const script = scriptMatch[1];

check("Syntaxe JavaScript valide", () => {
  fs.writeFileSync("/tmp/app-check.js", script);
  execFileSync(process.execPath, ["--check", "/tmp/app-check.js"], { stdio: "pipe" });
  return "node --check OK";
});

const NODE_IDS = [...script.matchAll(/\{ id: "([a-z-]+)", name:/g)].map(m => m[1]);
const EDGE_FROM = [...script.matchAll(/from: "([a-z-]+)"/g)].map(m => m[1]);
const EDGE_TO = [...script.matchAll(/to: "([a-z-]+)"/g)].map(m => m[1]);
const EDGE_SCENARIOS = [...script.matchAll(/scenario: "([a-z-]+)"/g)].map(m => m[1]);
const SCENARIO_IDS = [...script.matchAll(/\{ id: "([a-z-]+)", label:/g)].map(m => m[1]);

check("Références des flux vers des acteurs existants", () => {
  const bad = [...EDGE_FROM, ...EDGE_TO].filter(id => !NODE_IDS.includes(id));
  assert(bad.length === 0, `références inconnues : ${bad.join(", ")}`);
  return `${NODE_IDS.length} acteurs, ${EDGE_FROM.length} flux`;
});

check("Scénarios utilisés par les flux déclarés", () => {
  const bad = EDGE_SCENARIOS.filter(s => !SCENARIO_IDS.includes(s));
  assert(bad.length === 0, `scénarios inconnus : ${bad.join(", ")}`);
  return [...new Set(EDGE_SCENARIOS)].join(", ");
});

check("Chaque flux a une nature (type) déclarée", () => {
  const types = [...script.matchAll(/type: "([a-z]+)", from:/g)].map(m => m[1]);
  assert(types.length === EDGE_FROM.length, `natures manquantes : ${EDGE_FROM.length - types.length} flux`);
  return [...new Set(types)].join(", ");
});

check("Sources des flux valides (documente/rapporte/fictif)", () => {
  const srcs = [...script.matchAll(/source: "([a-z]+)"/g)].map(m => m[1]);
  const bad = srcs.filter(s => !["documente", "rapporte", "fictif"].includes(s));
  assert(bad.length === 0, `sources inconnues : ${bad.join(", ")}`);
  assert(srcs.length === EDGE_FROM.length, `nombre de sources (${srcs.length}) != nombre de flux (${EDGE_FROM.length})`);
  return `${srcs.length} flux qualifiés`;
});

check("Chaque acteur a une position desktop et mobile", () => {
  const nodes = script.split("const NODES =")[1].split("];")[0];
  const blocks = nodes.match(/\{ id: "[a-z-]+",[\s\S]*?\},/g) || [];
  assert(blocks.length === NODE_IDS.length, `blocs de nœuds lisibles : ${blocks.length}/${NODE_IDS.length}`);
  const bad = blocks.filter(b => !/x: \d+, y: \d+, my: \d+/.test(b));
  assert(bad.length === 0, `${bad.length} nœud(s) sans coordonnées desktop+mobile`);
  return `${blocks.length} nœuds positionnés (desktop + mobile)`;
});

function loadPage(width, height) {
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.innerWidth = width;
      window.innerHeight = height;
      window.requestAnimationFrame = () => {};
      window.addEventListener("error", e => errors.push(e.message));
    },
  });
  const w = dom.window;
  return { dom, w, errors };
}

function runDomChecks(width, height, label, expectedViewBox) {
  return new Promise(resolve => {
    const { dom, w, errors } = loadPage(width, height);
    setTimeout(() => {
      const svg = w.document.getElementById("graph");
      check(`Rendu ${label} sans erreur JS`, () => {
        assert(errors.length === 0, errors.join(" | "));
        return "0 erreur";
      });
      check(`Rendu ${label} : structure complète`, () => {
        const nodes = svg.querySelectorAll(".node").length;
        const edges = svg.querySelectorAll(".edge").length;
        const labels = svg.querySelectorAll("[data-edge-label]").length;
        const viewBox = svg.getAttribute("viewBox");
        assert(nodes === NODE_IDS.length, `acteurs : ${nodes}/${NODE_IDS.length}`);
        assert(edges === EDGE_FROM.length, `flux : ${edges}/${EDGE_FROM.length}`);
        assert(labels === EDGE_FROM.length, `étiquettes de montants : ${labels}/${EDGE_FROM.length}`);
        assert(viewBox === expectedViewBox, `viewBox "${viewBox}" != "${expectedViewBox}"`);
        return `${nodes} acteurs, ${edges} flux, viewBox ${viewBox}`;
      });
      check(`Rendu ${label} : particules d'animation générées`, () => {
        const circles = svg.querySelectorAll("circle").length;
        assert(circles > 0, "aucune particule");
        return `${circles} particules visibles`;
      });
      check(`Rendu ${label} : panneau d'introduction rempli`, () => {
        const cards = w.document.querySelectorAll("#panel .card").length;
        assert(cards >= 3, `${cards} carte(s) dans le panneau`);
        return `${cards} cartes`;
      });
      resolve();
    }, 600);
  });
}

(async () => {
  await runDomChecks(1280, 800, "desktop", "0 0 1200 760");
  await runDomChecks(390, 844, "mobile", "0 0 400 1400");

  check("Bascule desktop ↔ mobile au redimensionnement", () => {
    return new Promise(resolve => {
      const { w } = loadPage(1280, 800);
      setTimeout(() => {
        const svg = w.document.getElementById("graph");
        assert(svg.getAttribute("viewBox") === "0 0 1200 760", "viewBox desktop initial incorrect");
        w.innerWidth = 390;
        w.dispatchEvent(new w.Event("resize"));
        setTimeout(() => {
          assert(svg.getAttribute("viewBox") === "0 0 400 1400", "viewBox mobile attendu après resize");
          assert(svg.querySelectorAll(".node").length === NODE_IDS.length, "acteurs manquants après resize");
          resolve("viewBox 1200x760 → 400x1400, acteurs conservés");
        }, 400);
      }, 600);
    });
  });

  check("Scénario isole bien les flux", () => {
    return new Promise(resolve => {
      const { w } = loadPage(1280, 800);
      setTimeout(() => {
        const btn = [...w.document.querySelectorAll("#scenarios button")].find(b => b.dataset.id === "nvidia-loop");
        btn.click();
        const dimmed = w.document.querySelectorAll(".edge.dimmed").length;
        const visible = w.document.querySelectorAll(".edge:not(.dimmed)").length;
        assert(visible > 0 && dimmed > 0, `visible=${visible}, atténués=${dimmed}`);
        assert(visible + dimmed === EDGE_FROM.length, "tous les flux ne sont pas rendus");
        resolve(`${visible} flux actifs, ${dimmed} atténués`);
      }, 600);
    });
  });

  const timer = setInterval(() => {
    if (pending > 0) return;
    clearInterval(timer);
    if (failures > 0) {
      console.error(`\n${failures} vérification(s) en échec`);
      process.exit(1);
    }
    console.log("\nToutes les vérifications sont passées");
  }, 100);
})();
