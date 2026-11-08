const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const HTML = path.join(ROOT, "dist", "index.html");
const DATA = path.join(ROOT, "src", "data.js");
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

execFileSync("npm", ["run", "build"], { cwd: ROOT, stdio: "pipe" });

check("Build du projet (esbuild) produit dist/", () => {
  for (const f of ["index.html", "bundle.js", "bundle.css"]) {
    assert(fs.existsSync(path.join(ROOT, "dist", f)), `dist/${f} manquant`);
  }
  return "dist/index.html, bundle.js, bundle.css générés";
});

const html = fs.readFileSync(HTML, "utf8");
const script = fs.readFileSync(DATA, "utf8");

const NODE_IDS = [...script.matchAll(/\{ id: "([a-z-]+)", name:/g)].map(m => m[1]);
const EDGE_FROM = [...script.matchAll(/from: "([a-z-]+)"/g)].map(m => m[1]);
const EDGE_TO = [...script.matchAll(/to: "([a-z-]+)"/g)].map(m => m[1]);
const EDGE_SCENARIOS = [...script.matchAll(/scenario: "([a-z-]+)"/g)].map(m => m[1]);
const SCENARIO_IDS = [...script.matchAll(/\{ id: "([a-z-]+)", label:/g)].map(m => m[1]);

check("Bibliothèques (d3, dagre) résolues par npm et intégrées au bundle", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  for (const dep of ["d3-selection", "d3-shape", "d3-zoom", "dagre"]) {
    assert(pkg.dependencies && pkg.dependencies[dep], `dépendance ${dep} absente de package.json`);
  }
  const bundle = fs.readFileSync(path.join(ROOT, "dist", "bundle.js"), "utf8");
  assert(bundle.includes("graphlib") || bundle.includes("dagre"), "dagre absent du bundle");
  assert(html.includes('src="bundle.js"'), "bundle.js n'est pas chargé par dist/index.html");
  return "d3 + dagre bundlés";
});

check("Aucune position manuelle résiduelle dans les acteurs", () => {
  assert(!/\bx: \d+, y: \d+/.test(script), "coordonnées manuelles x/y encore présentes dans NODES");
  assert(!/\bmy: \d+/.test(script), "coordonnées mobiles manuelles my: encore présentes dans NODES");
  return "positions 100 % calculées par le layout";
});

check("Module D3 utilisé pour le rendu (sélection, formes, zoom)", () => {
  const main = fs.readFileSync(path.join(ROOT, "src", "main.js"), "utf8");
  for (const mod of ["d3-selection", "d3-shape", "d3-zoom"]) {
    assert(main.includes('"' + mod + '"'), `import ${mod} absent de src/main.js`);
  }
  assert(main.includes("linkHorizontal") && main.includes("linkVertical"), "générateurs de liens d3-shape inutilisés");
  assert(main.includes("zoom("), "comportement de zoom non attaché");
  return "d3-selection, d3-shape (liens), d3-zoom actifs";
});

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

function loadPage(width, height) {
  const errors = [];
  const dom = new JSDOM(html, {
    url: "file://" + HTML.replace(/\\/g, "/"),
    runScripts: "dangerously",
    pretendToBeVisual: true,
    resources: "usable",
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

function runDomChecks(width, height, label, orientation) {
  return new Promise(resolve => {
    const { w, errors } = loadPage(width, height);
    setTimeout(() => {
      w.innerWidth = width;
      w.innerHeight = height;
      w.dispatchEvent(new w.Event("resize"));
      setTimeout(() => {
      const svg = w.document.getElementById("graph");
      check(`Rendu ${label} sans erreur JS`, () => {
        assert(errors.length === 0, errors.join(" | "));
        assert(w.document.querySelectorAll(".node").length > 0, "l'application n'a pas démarré");
        return "0 erreur, application démarrée";
      });
      check(`Rendu ${label} : structure complète`, () => {
        const nodes = svg.querySelectorAll(".node").length;
        const edges = svg.querySelectorAll(".edge").length;
        const labels = svg.querySelectorAll("[data-edge-label]").length;
        assert(nodes === NODE_IDS.length, `acteurs : ${nodes}/${NODE_IDS.length}`);
        assert(edges === EDGE_FROM.length, `flux : ${edges}/${EDGE_FROM.length}`);
        assert(labels === EDGE_FROM.length, `étiquettes de montants : ${labels}/${EDGE_FROM.length}`);
        return `${nodes} acteurs, ${edges} flux`;
      });
      check(`Rendu ${label} : layout calculé et dans le cadre`, () => {
        const vb = svg.getAttribute("viewBox").split(" ").map(Number);
        const [W, H] = [vb[2], vb[3]];
        assert(W > 0 && H > 0 && !isNaN(W) && !isNaN(H), `viewBox invalide : ${vb.join(" ")}`);
        if (orientation === "desktop") {
          assert(W >= 700, `desktop attendu étalé en largeur (LR), viewBox ${W}x${H}`);
        } else {
          assert(W <= 500, `mobile attendu en colonne étroite, viewBox ${W}x${H}`);
          assert(H > W, `mobile attendu plus haut que large, viewBox ${W}x${H}`);
        }
        svg.querySelectorAll(".node rect").forEach(r => {
          const x = +r.getAttribute("x"), y = +r.getAttribute("y");
          assert(!isNaN(x) && !isNaN(y), "position non calculée (NaN)");
          assert(x >= 0 && y >= 0, `nœud hors cadre (négatif) : ${x},${y}`);
          assert(x + 160 <= W + 1 && y + 64 <= H + 1, `nœud hors cadre : ${x},${y} dans ${W}x${H}`);
        });
        return `viewBox ${W}x${H}, ${NODE_IDS.length} acteurs positionnés`;
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
      }, 400);
    }, 1500);
  });
}

(async () => {
  await runDomChecks(1280, 800, "desktop", "desktop");
  await runDomChecks(390, 844, "mobile", "mobile");

  check("Bascule desktop ↔ mobile au redimensionnement", () => {
    return new Promise((resolve, reject) => {
      const { w } = loadPage(1280, 800);
      setTimeout(() => {
        try {
          w.innerWidth = 1280;
          w.dispatchEvent(new w.Event("resize"));
          setTimeout(() => {
            try {
              const svg = w.document.getElementById("graph");
              const desktopVb = svg.getAttribute("viewBox").split(" ").map(Number);
              assert(desktopVb[2] >= 700, `viewBox desktop initial incorrect : ${desktopVb.join(" ")}`);
              w.innerWidth = 390;
              w.dispatchEvent(new w.Event("resize"));
              setTimeout(() => {
                try {
                  const vb = svg.getAttribute("viewBox").split(" ").map(Number);
                  assert(vb[3] > vb[2] && vb[2] <= 500, `viewBox mobile en colonne attendu, reçu ${vb.join(" ")}`);
                  assert(svg.querySelectorAll(".node").length === NODE_IDS.length, "acteurs manquants après resize");
                  resolve(`viewBox ${desktopVb[2]}x${desktopVb[3]} → ${vb[2]}x${vb[3]}, acteurs conservés`);
                } catch (err) { reject(err); }
              }, 400);
            } catch (err) { reject(err); }
          }, 400);
        } catch (err) { reject(err); }
      }, 1500);
    });
  });

  check("Scénario isole bien les flux", () => {
    return new Promise((resolve, reject) => {
      const { w } = loadPage(1280, 800);
      setTimeout(() => {
        try {
          const btn = [...w.document.querySelectorAll("#scenarios button")].find(b => b.dataset.id === "nvidia-loop");
          assert(btn, "bouton de scénario nvidia-loop introuvable");
          btn.click();
          const dimmed = w.document.querySelectorAll(".edge.dimmed").length;
          const visible = w.document.querySelectorAll(".edge:not(.dimmed)").length;
          assert(visible > 0 && dimmed > 0, `visible=${visible}, atténués=${dimmed}`);
          assert(visible + dimmed === EDGE_FROM.length, "tous les flux ne sont pas rendus");
          resolve(`${visible} flux actifs, ${dimmed} atténués`);
        } catch (err) { reject(err); }
      }, 1500);
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
