import { select } from "d3-selection";
import { linkHorizontal, linkVertical } from "d3-shape";
import { zoom } from "d3-zoom";
import dagre from "dagre";
import "./styles.css";
import { TYPES, FLOW_TYPES, NODES, SOURCES, EDGES, MOBILE_ORDER, SCENARIOS } from "./data.js";

const svg = document.getElementById("graph");
const panel = document.getElementById("panel");
let running = true;
let speed = 1;
let showLabels = true;
let activeScenario = "all";
let particles = [];
let selectedNode = null;
let selectedEdge = null;
let layoutPos = {};
let currentViewBox = "0 0 1200 760";

function isMobileScreen() {
  return window.innerWidth < 700;
}

function nodeById(id) {
  return NODES.find(n => n.id === id);
}

function getPos(nd) {
  return layoutPos[nd.id];
}

function computeLayout() {
  const g = new dagre.graphlib.Graph();
  if (isMobileScreen()) {
    g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 80, marginx: 20, marginy: 20 });
    NODES.forEach(nd => g.setNode(nd.id, { width: 160, height: 64 }));
    for (let i = 0; i < MOBILE_ORDER.length - 1; i++) {
      g.setEdge(MOBILE_ORDER[i], MOBILE_ORDER[i + 1], {});
    }
  } else {
    g.setGraph({ rankdir: "LR", nodesep: 55, ranksep: 120, marginx: 30, marginy: 30 });
    NODES.forEach(nd => g.setNode(nd.id, { width: 160, height: 64 }));
    EDGES.forEach(e => g.setEdge(e.from, e.to, {}));
  }
  dagre.layout(g);
  layoutPos = {};
  NODES.forEach(nd => {
    const c = g.node(nd.id);
    layoutPos[nd.id] = { x: c.x - 80, y: c.y - 32 };
  });
  currentViewBox = "0 0 " + Math.ceil(g.graph().width) + " " + Math.ceil(g.graph().height);
}

function edgeColor(e) {
  return (FLOW_TYPES[e.type] || FLOW_TYPES.achat).color;
}

function port(nd) {
  const p = getPos(nd);
  return { x: p.x + 80, y: p.y + 32 };
}

function edgeGeom(e) {
  const s = port(nodeById(e.from));
  const t = port(nodeById(e.to));
  if (isMobileScreen()) {
    const my = (s.y + t.y) / 2;
    return { s, t, c1: { x: s.x, y: my }, c2: { x: t.x, y: my } };
  }
  const mx = (s.x + t.x) / 2;
  return { s, t, c1: { x: mx, y: s.y }, c2: { x: mx, y: t.y } };
}

function linkGenerator() {
  const gen = isMobileScreen() ? linkVertical() : linkHorizontal();
  return gen
    .source(d => edgeGeom(d).s)
    .target(d => edgeGeom(d).t);
}

function pointOn(g, t) {
  const u = 1 - t;
  return {
    x: u * u * u * g.s.x + 3 * u * u * t * g.c1.x + 3 * u * t * t * g.c2.x + t * t * t * g.t.x,
    y: u * u * u * g.s.y + 3 * u * u * t * g.c1.y + 3 * u * t * t * g.c2.y + t * t * t * g.t.y,
  };
}

function build() {
  particles = [];
  computeLayout();
  const root = select(svg);
  root.attr("viewBox", currentViewBox);
  root.selectAll("*").remove();

  const defs = root.append("defs");
  defs.selectAll("marker")
    .data(EDGES, d => d.id)
    .join("marker")
      .attr("id", d => "arrow-" + d.id)
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 9)
      .attr("refY", 5)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto-start-reverse")
    .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", d => edgeColor(d))
      .attr("opacity", 0.9);

  const gRoot = root.append("g").attr("id", "graph-root");
  const gEdges = gRoot.append("g");
  const gParticles = gRoot.append("g").attr("id", "particles-layer");
  const gNodes = gRoot.append("g");
  const gLabels = gRoot.append("g");

  const link = linkGenerator();

  const edge = gEdges.selectAll("g")
    .data(EDGES, d => d.id)
    .join("g")
      .attr("class", "edge")
      .attr("data-id", d => d.id);

  edge.append("path")
    .attr("class", "edge-path")
    .attr("d", link)
    .attr("stroke", d => edgeColor(d))
    .attr("stroke-width", d => d.source === "fictif" ? 1.6 : 2.4)
    .attr("opacity", 0.55)
    .attr("fill", "none")
    .attr("marker-end", d => "url(#arrow-" + d.id + ")")
    .attr("stroke-dasharray", d => (d.source === "fictif" ? "7 5" : null));

  edge.append("path")
    .attr("class", "edge-hit")
    .attr("d", link)
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", 18)
    .on("click", (event, d) => selectEdge(d));

  if (showLabels) {
    gLabels.selectAll("text")
      .data(EDGES, d => d.id)
      .join("text")
        .attr("class", "edge-label")
        .attr("data-edge-label", d => d.id)
        .attr("x", d => pointOn(edgeGeom(d), 0.5).x)
        .attr("y", d => pointOn(edgeGeom(d), 0.5).y - 7)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("fill", "#c7d2ee")
        .text(d => d.amount);
  }

  const node = gNodes.selectAll("g")
    .data(NODES, d => d.id)
    .join("g")
      .attr("class", "node")
      .attr("data-id", d => d.id)
      .on("click", (event, d) => selectNode(d));

  node.append("rect")
    .attr("x", d => getPos(d).x)
    .attr("y", d => getPos(d).y)
    .attr("width", 160)
    .attr("height", 64)
    .attr("rx", 12)
    .attr("fill", "#141d3a")
    .attr("stroke", d => TYPES[d.type].color)
    .attr("stroke-width", d => (d.fictif ? 1.6 : 2.2))
    .attr("stroke-dasharray", d => (d.fictif ? "6 4" : null));

  node.append("text")
    .attr("x", d => getPos(d).x + 80)
    .attr("y", d => getPos(d).y + 30)
    .attr("text-anchor", "middle")
    .attr("font-size", 13.5)
    .attr("font-weight", 600)
    .attr("fill", "#fff")
    .text(d => d.name);

  node.append("text")
    .attr("x", d => getPos(d).x + 80)
    .attr("y", d => getPos(d).y + 48)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .attr("fill", d => TYPES[d.type].color)
    .text(d => (d.fictif ? "Fictif — " : "") + TYPES[d.type].label);

  EDGES.forEach(e => {
    const n = e.frequency || 1;
    for (let i = 0; i < n; i++) {
      particles.push({ edge: e, t: i / n });
    }
  });

  root.call(
    zoom()
      .scaleExtent([0.4, 4])
      .on("zoom", event => gRoot.attr("transform", event.transform))
  );
}

function isEdgeActive(e) {
  return activeScenario === "all" || e.scenario === activeScenario || e.scenario === "all";
}

function pathLength(g) {
  let len = 0;
  let prev = pointOn(g, 0);
  for (let i = 1; i <= 12; i++) {
    const p = pointOn(g, i / 12);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

const BASE_SPEED = 55;
let lastFrame = null;

function animate() {
  const layer = select(svg).select("#particles-layer");
  const visible = particles.filter(p => isEdgeActive(p.edge));
  const now = performance.now();
  const dt = lastFrame === null ? 0 : Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  if (running) {
    visible.forEach(p => {
      const g = edgeGeom(p.edge);
      const voltage = 0.4 + (p.edge.magnitude || 0.5);
      const px = BASE_SPEED * voltage * speed * dt;
      const len = pathLength(g) || 1;
      p.t = (p.t + px / len) % 1;
    });
  }
  layer.selectAll("circle")
    .data(visible, (d, i) => i)
    .join("circle")
      .attr("r", d => 2.6 + (d.edge.magnitude || 0.5) * 1.6)
      .attr("cx", d => pointOn(edgeGeom(d.edge), d.t).x)
      .attr("cy", d => pointOn(edgeGeom(d.edge), d.t).y)
      .attr("fill", d => edgeColor(d.edge))
      .attr("opacity", 0.95);
  requestAnimationFrame(animate);
}

function applyScenario(id) {
  activeScenario = id;
  document.querySelectorAll("#scenarios button").forEach(b => {
    b.classList.toggle("active", b.dataset.id === id);
  });
  document.querySelectorAll(".edge").forEach(g => {
    const e = EDGES.find(x => x.id === g.dataset.id);
    g.classList.toggle("dimmed", !isEdgeActive(e));
  });
  document.querySelectorAll("[data-edge-label]").forEach(t => {
    const e = EDGES.find(x => x.id === t.dataset.edgeLabel);
    t.classList.toggle("dimmed", !isEdgeActive(e));
  });
}

function badge(e) {
  const s = SOURCES[e.source];
  return '<span class="badge ' + s.cls + '">' + s.txt + '</span>';
}

function selectNode(nd) {
  selectedNode = nd;
  selectedEdge = null;
  const flowsIn = EDGES.filter(e => e.to === nd.id);
  const flowsOut = EDGES.filter(e => e.from === nd.id);
  const flowItem = e =>
    '<div class="flow-item" data-edge="' + e.id + '"><span class="lbl">' +
    nodeById(e.from === nd.id ? e.to : e.from).name + " · " + e.label +
    '</span><span class="amt">' + e.amount + "</span></div>";
  panel.innerHTML = `
    <div class="card">
      <h3>${nd.name} <span class="badge ${nd.fictif ? "badge-fictif" : "badge-public"}">${nd.fictif ? "Fictif" : "Réel"}</span></h3>
      <p>${nd.desc}</p>
    </div>
    <div class="card">
      <h3>Flux entrants (argent reçu)</h3>
      <div class="flow-list">
        ${flowsIn.map(e => '<div class="flow-item" data-edge="' + e.id + '"><span class="lbl">' + nodeById(e.from).name + " · " + e.label + '</span><span class="amt">' + e.amount + "</span></div>").join("") || "<p>Aucun</p>"}
      </div>
    </div>
    <div class="card">
      <h3>Flux sortants (argent versé)</h3>
      <div class="flow-list">
        ${flowsOut.map(e => '<div class="flow-item" data-edge="' + e.id + '"><span class="lbl">' + nodeById(e.to).name + " · " + e.label + '</span><span class="amt">' + e.amount + "</span></div>").join("") || "<p>Aucun</p>"}
      </div>
    </div>`;
  panel.querySelectorAll(".flow-item").forEach(el => {
    el.addEventListener("click", () => selectEdge(EDGES.find(x => x.id === el.dataset.edge)));
  });
}

function selectEdge(e) {
  selectedEdge = e;
  selectedNode = null;
  panel.innerHTML = `
    <div class="card">
      <h3>${e.label} ${badge(e)}</h3>
      <p><strong>${nodeById(e.from).name} → ${nodeById(e.to).name}</strong></p>
      <p><strong>Nature du flux :</strong> <span style="color:${edgeColor(e)}">${FLOW_TYPES[e.type].label}</span></p>
      <p><strong>Montant :</strong> ${e.amount}</p>
      <p>${e.desc}</p>
    </div>
    <div class="card">
      <h3>Comment lire la boucle ?</h3>
      <p>${nodeById(e.from).name} verse de l'argent à ${nodeById(e.to).name}. Suivez ensuite les autres flux depuis ${nodeById(e.to).name} : une partie de cet argent a de bonnes chances de revenir, directement ou indirectement, à ${nodeById(e.from).name}.</p>
      <p>C'est cette réinjection continue qui caractérise le modèle d'économie circulaire de l'IA : chaque acteur est à la fois client, fournisseur et investisseur des autres.</p>
    </div>`;
}

function introPanel() {
  panel.innerHTML = `
    <div class="card">
      <h3>Économie circulaire de l'IA</h3>
      <p>Cette visualisation montre comment l'argent tourne en boucle dans l'écosystème de l'IA générative, à partir de l'exemple documenté de <strong>Nvidia</strong>, d'<strong>OpenAI</strong>, des clouds (Microsoft Azure, CoreWeave, Oracle) et de SoftBank.</p>
      <p>Le principe : <strong>Nvidia investit dans OpenAI, qui achète des puces Nvidia</strong>. Microsoft investit dans OpenAI, qui dépense sur Azure, qui achète des GPU Nvidia. Les banques prêtent aux datacenters qui achètent les puces, et Nvidia place sa trésorerie… auprès des banques.</p>
      <p><strong>Les couleurs indiquent la nature du flux financier</strong> (participation, achat, crédit, garantie, commissions…), pas le secteur d'origine de l'argent. Les flux en <strong style="color:var(--fictive)">pointillés</strong> sont fictifs : ils illustrent des rôles dont les données réelles ne sont pas publiques. La Fed, elle, est réelle : elle alimente toute la chaîne de crédit en réserves.</p>
      <p><strong>Lecture de l'animation</strong> : la <strong>vitesse</strong> d'une particule encode l'intensité relative du flux (le « voltage » : un tour de table de 100 Mds$ circule plus vite qu'une ligne de crédit) ; le <strong>nombre</strong> de particules encode la fréquence (l'« intensité » : les abonnements clients circulent en continu, un investissement exceptionnel ne passe qu'une fois).</p>
    </div>
    <div class="card">
      <h3>Scénarios</h3>
      <p>Utilisez les boutons en haut pour isoler une boucle : <strong>Nvidia</strong> (investissement contre engagement d'achat), <strong>cloud</strong> (capital → compute → GPU), ou <strong>financement bancaire</strong> (dette et structuration).</p>
    </div>
    <div class="card">
      <h3>La question clé</h3>
      <p>Un seul flux ne boucle pas : les <strong style="color:var(--customer)">clients finaux</strong>. Si leurs paiements ne couvrent pas assez vite les engagements, la boucle fonctionne à crédit — et dépend des banques pour tenir.</p>
    </div>`;
}

function initControls() {
  const sc = document.getElementById("scenarios");
  SCENARIOS.forEach(s => {
    const b = document.createElement("button");
    b.textContent = s.label;
    b.dataset.id = s.id;
    if (s.id === "all") b.classList.add("active");
    b.addEventListener("click", () => applyScenario(s.id));
    sc.appendChild(b);
  });
  document.getElementById("toggle-flow").addEventListener("click", e => {
    running = !running;
    e.target.textContent = running ? "⏸ Pause" : "▶ Lecture";
    e.target.classList.toggle("active", running);
  });
  document.getElementById("speed").addEventListener("change", e => {
    speed = parseFloat(e.target.value);
  });
  document.getElementById("toggle-labels").addEventListener("click", e => {
    showLabels = !showLabels;
    e.target.classList.toggle("active", showLabels);
    build();
    applyScenario(activeScenario);
    if (selectedNode) selectNode(selectedNode);
    else if (selectedEdge) selectEdge(selectedEdge);
    else introPanel();
  });
  const legend = document.getElementById("legend");
  legend.innerHTML = Object.entries(FLOW_TYPES).map(([k, v]) =>
    '<span class="legend-item"><span class="dot" style="background:' + v.color + '"></span>' + v.label + "</span>"
  ).join("") + '<span class="legend-item">— pointillés = flux fictif · bordure rouge pointillée = acteur fictif</span>';
}

let started = false;
function startApp() {
  if (started) return;
  started = true;
  initControls();
  build();
  introPanel();
  animate();
  let lastMobile = isMobileScreen();
  window.addEventListener("resize", () => {
    const nowMobile = isMobileScreen();
    if (nowMobile !== lastMobile) {
      lastMobile = nowMobile;
      build();
      applyScenario(activeScenario);
      if (selectedNode) selectNode(selectedNode);
      else if (selectedEdge) selectEdge(selectedEdge);
      else introPanel();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}
