import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { GraphData, NoteType } from '../../../shared/api.ts';
import { api } from '../api.ts';
import { Empty, ErrorNotice, Icon, Loading } from '../components/ui.tsx';
import { compareDomains, domainColorMap, domainLabel, plural, typeSingular } from '../format.ts';
import { navigate, noteHref, useApi } from '../hooks.ts';

interface Node extends SimulationNodeDatum {
  id: string;
  title: string;
  domain: string;
  type: NoteType;
  degree: number;
  r: number;
}
type Link = SimulationLinkDatum<Node> & { source: Node; target: Node };

interface Layout {
  nodes: Node[];
  links: Link[];
  neighbors: Map<string, Set<string>>;
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

/** Calcule la disposition une fois, hors rendu : le graphe d'une mémoire de notes reste petit. */
function computeLayout(data: GraphData): Layout {
  const nodes: Node[] = data.nodes.map((n) => ({ ...n, r: 4 + Math.sqrt(n.degree) * 2.6 }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links: Link[] = [];
  const neighbors = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set<string>()]));
  for (const e of data.edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t || s === t) continue;
    links.push({ source: s, target: t });
    neighbors.get(s.id)!.add(t.id);
    neighbors.get(t.id)!.add(s.id);
  }
  // Position de départ regroupée par domaine : la simulation converge plus vite et plus lisiblement.
  const domains = [...new Set(nodes.map((n) => n.domain))].sort(compareDomains);
  nodes.forEach((n, i) => {
    const a = (domains.indexOf(n.domain) / Math.max(1, domains.length)) * Math.PI * 2;
    n.x = Math.cos(a) * 200 + (i % 7) * 3;
    n.y = Math.sin(a) * 200 + (i % 5) * 3;
  });
  const sim = forceSimulation<Node>(nodes)
    .force(
      'link',
      forceLink<Node, Link>(links)
        .id((n) => n.id)
        .distance((l) => 30 + l.source.r + l.target.r)
        .strength(0.5),
    )
    .force('charge', forceManyBody<Node>().strength(-140).distanceMax(500))
    .force('collide', forceCollide<Node>((n) => n.r + 3))
    .force('x', forceX<Node>(0).strength(0.04))
    .force('y', forceY<Node>(0).strength(0.04))
    .force('center', forceCenter(0, 0))
    .stop();
  const ticks = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()));
  for (let i = 0; i < ticks; i++) sim.tick();

  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.x! - n.r);
    y0 = Math.min(y0, n.y! - n.r);
    x1 = Math.max(x1, n.x! + n.r);
    y1 = Math.max(y1, n.y! + n.r);
  }
  if (!nodes.length) [x0, y0, x1, y1] = [-100, -100, 100, 100];
  return { nodes, links, neighbors, bounds: { x0, y0, x1, y1 } };
}

interface View {
  x: number;
  y: number;
  k: number;
}

export function GraphView() {
  const graph = useApi('graph', api.graph);
  const layout = useMemo(() => (graph.data ? computeLayout(graph.data) : null), [graph.data]);
  const domains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of graph.data?.nodes ?? []) counts.set(n.domain, (counts.get(n.domain) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => compareDomains(a[0], b[0]));
  }, [graph.data]);
  const colors = useMemo(() => domainColorMap(domains.map((d) => d[0])), [domains]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const toggle = (d: string, solo: boolean) =>
    setHidden((h) => {
      if (solo) {
        const others = domains.map((x) => x[0]).filter((x) => x !== d);
        const alreadySolo = !h.has(d) && others.every((o) => h.has(o));
        return alreadySolo ? new Set() : new Set(others);
      }
      const next = new Set(h);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  return (
    <div className="stack">
      <div className="section-head">
        <h2>Carte des liens</h2>
        {graph.data && (
          <span className="muted small">
            {plural(graph.data.nodes.length, 'note', 'notes')} · {plural(graph.data.edges.length, 'lien', 'liens')}
          </span>
        )}
      </div>
      {graph.error && <ErrorNotice error={graph.error} onRetry={graph.reload} />}
      {!graph.data && !graph.error && <Loading label="Calcul de la carte…" />}
      {graph.data && graph.data.nodes.length === 0 && (
        <div className="card">
          <Empty>Aucune note à afficher.</Empty>
        </div>
      )}
      {layout && layout.nodes.length > 0 && (
        <>
          <div className="legend-row graph-legend" role="group" aria-label="Domaines affichés">
            {domains.map(([d, n]) => (
              <button
                key={d}
                className={`key legend-btn${hidden.has(d) ? ' off' : ''}`}
                aria-pressed={!hidden.has(d)}
                onClick={(e) => toggle(d, e.altKey || e.metaKey)}
                onDoubleClick={() => toggle(d, true)}
                title="Clic : afficher ou masquer. Double-clic : ce domaine seul."
              >
                <i style={{ background: colors.get(d) }} />
                {domainLabel(d)} <span className="muted">{n}</span>
              </button>
            ))}
            {hidden.size > 0 && (
              <button className="linkish" onClick={() => setHidden(new Set())}>
                Tout afficher
              </button>
            )}
          </div>
          <GraphCanvas layout={layout} colors={colors} hidden={hidden} />
        </>
      )}
    </div>
  );
}

function GraphCanvas({ layout, colors, hidden }: { layout: Layout; colors: Map<string, string>; hidden: Set<string> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [view, setView] = useState<View>({ x: 400, y: 280, k: 1 });
  const [hover, setHover] = useState<string | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ w: Math.max(200, entry.contentRect.width), h: Math.max(240, entry.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const { x0, y0, x1, y1 } = layout.bounds;
    const pad = 24;
    const k = Math.min(2, (size.w - pad * 2) / Math.max(1, x1 - x0), (size.h - pad * 2) / Math.max(1, y1 - y0));
    setView({ k, x: size.w / 2 - ((x0 + x1) / 2) * k, y: size.h / 2 - ((y0 + y1) / 2) * k });
  }, [layout, size]);

  // Recadrer à l'arrivée des données et quand la taille change nettement.
  const fittedFor = useRef<string>('');
  useEffect(() => {
    const key = `${layout.nodes.length}:${Math.round(size.w / 50)}:${Math.round(size.h / 50)}`;
    if (fittedFor.current === key) return;
    fittedFor.current = key;
    fit();
  }, [fit, layout, size]);

  const zoomAt = (px: number, py: number, factor: number) => {
    setView((v) => {
      const k = Math.min(8, Math.max(0.1, v.k * factor));
      const f = k / v.k;
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });
  };

  // Molette : écouteur non passif pour empêcher le défilement de la page.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.002)));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // Déplacement (un doigt ou souris) et pincement (deux doigts).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; nodeId: string | null; pinch?: { dist: number; cx: number; cy: number } } | null>(null);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    const nodeId = (e.target as Element).closest('[data-id]')?.getAttribute('data-id') ?? null;
    if (pointers.current.size === 1) gesture.current = { moved: 0, nodeId };
    else if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      gesture.current.moved = Infinity; // un pincement n'est jamais un clic
    }
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === 'mouse') setHover((e.target as Element).closest('[data-id]')?.getAttribute('data-id') ?? null);
      return;
    }
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (pointers.current.size >= 2 && g.pinch) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const { dist: d0, cx: cx0, cy: cy0 } = g.pinch;
      setView((v) => {
        const k = Math.min(8, Math.max(0.1, (v.k * dist) / Math.max(1, d0)));
        const f = k / v.k;
        return { k, x: cx - (cx0 - v.x) * f, y: cy - (cy0 - v.y) * f };
      });
      g.pinch = { dist, cx, cy };
      return;
    }
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    g.moved += Math.abs(dx) + Math.abs(dy);
    if (g.moved > 4) setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 0) {
      if (g && g.moved <= 4 && g.nodeId && e.type === 'pointerup') navigate(noteHref(g.nodeId));
      gesture.current = null;
    } else if (g) {
      g.pinch = undefined;
    }
  };

  const visible = (n: Node) => !hidden.has(n.domain);
  const focus = hover ? layout.neighbors.get(hover) : null;
  const isLit = (id: string) => !hover || id === hover || !!focus?.has(id);
  const hovered = hover ? layout.nodes.find((n) => n.id === hover) : null;
  const showAllLabels = view.k >= 1.4;
  const maxDegree = Math.max(1, ...layout.nodes.map((n) => n.degree));

  return (
    <div className="card flush graph-card">
      <div className="graph-tools">
        <button className="btn" onClick={() => zoomAt(size.w / 2, size.h / 2, 1.3)} aria-label="Zoomer">
          <Icon name="plus" />
        </button>
        <button className="btn" onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.3)} aria-label="Dézoomer">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <button className="btn" onClick={fit} aria-label="Recentrer">
          <Icon name="target" />
        </button>
      </div>
      <div className="graph-wrap" ref={wrapRef}>
        <svg
          ref={svgRef}
          className="graph"
          width={size.w}
          height={size.h}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={(e) => e.pointerType === 'mouse' && !pointers.current.size && setHover(null)}
          role="img"
          aria-label="Graphe des liens entre notes"
        >
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            <g className="edges">
              {layout.links.map((l, i) =>
                visible(l.source) && visible(l.target) ? (
                  <line
                    key={i}
                    x1={l.source.x}
                    y1={l.source.y}
                    x2={l.target.x}
                    y2={l.target.y}
                    className={hover ? (l.source.id === hover || l.target.id === hover ? 'lit' : 'dim') : undefined}
                    strokeWidth={1 / Math.sqrt(view.k)}
                  />
                ) : null,
              )}
            </g>
            <g className="nodes">
              {layout.nodes.map((n) =>
                visible(n) ? (
                  <g key={n.id} data-id={n.id} className={`node${isLit(n.id) ? '' : ' dim'}${n.id === hover ? ' hover' : ''}`} transform={`translate(${n.x},${n.y})`}>
                    <circle r={n.r} fill={colors.get(n.domain)} />
                    {(showAllLabels || n.degree >= maxDegree * 0.45 || (hover && isLit(n.id))) && (
                      <text y={n.r + 11 / view.k} fontSize={11 / view.k} textAnchor="middle">
                        {n.title.length > 40 ? `${n.title.slice(0, 38)}…` : n.title}
                      </text>
                    )}
                  </g>
                ) : null,
              )}
            </g>
          </g>
        </svg>
        {hovered && (
          <div className="graph-tip">
            <b>{hovered.title}</b>
            <span className="muted">
              {domainLabel(hovered.domain)} · {typeSingular(hovered.type)} · {plural(hovered.degree, 'lien', 'liens')}
            </span>
            <span className="mono muted small">{hovered.id}</span>
          </div>
        )}
      </div>
      <div className="graph-hint muted small">Molette ou pincement pour zoomer, glisser pour déplacer, clic sur une note pour l’ouvrir.</div>
    </div>
  );
}
