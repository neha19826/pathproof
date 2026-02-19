import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphEdge, D3Node, D3Link } from '@/types';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';

interface GraphVisualizationProps {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  node: GraphNode | null;
}

function scoreColor(score: number): string {
  if (score >= 60) return 'hsl(0 84% 58%)';       // red
  if (score >= 30) return 'hsl(38 95% 55%)';       // amber
  return 'hsl(220 60% 55%)';                        // blue
}

function nodeRadius(node: GraphNode, isSuspicious: boolean): number {
  const base = 6;
  const extra = isSuspicious ? Math.min(10, node.suspicionScore / 10) : 0;
  return base + extra;
}

export function GraphVisualization({ nodes, edges }: GraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, node: null });
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);

  const resetZoom = useCallback(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(500).call(
      (d3.zoom() as any).transform,
      d3.zoomIdentity
    );
  }, []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.size === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Cap nodes for performance
    const MAX_NODES = 300;
    const nodeArray = Array.from(nodes.values());
    
    // Prioritize suspicious nodes
    const suspicious = nodeArray.filter((n) => n.isSuspicious);
    const normal = nodeArray.filter((n) => !n.isSuspicious);
    const displayNodes = [...suspicious, ...normal].slice(0, MAX_NODES);
    const displayNodeIds = new Set(displayNodes.map((n) => n.id));

    const d3Nodes: D3Node[] = displayNodes.map((n) => ({
      id: n.id,
      suspicionScore: n.suspicionScore,
      isSuspicious: n.isSuspicious,
      detectedPatterns: n.detectedPatterns,
      ringId: n.ringId,
      totalTransactions: n.totalTransactions,
    }));

    const d3Links: D3Link[] = edges
      .filter((e) => displayNodeIds.has(e.source) && displayNodeIds.has(e.target))
      .slice(0, 800)
      .map((e) => ({
        source: e.source,
        target: e.target,
        amount: e.amount,
        transactionId: e.transactionId,
      }));

    setNodeCount(displayNodes.length);
    setEdgeCount(d3Links.length);

    // Clear
    const svgEl = svgRef.current;
    d3.select(svgEl).selectAll('*').remove();

    const svg = d3.select(svgEl)
      .attr('width', width)
      .attr('height', height);

    // Zoom
    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Arrow marker
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'hsl(228 18% 30%)');

    defs.append('marker')
      .attr('id', 'arrowhead-suspicious')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'hsl(0 84% 58% / 0.6)');

    // Glow filter for suspicious nodes
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Build node lookup for link drawing
    const nodeMap = new Map(d3Nodes.map((n) => [n.id, n]));

    // Simulation
    const simulation = d3.forceSimulation<D3Node>(d3Nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(d3Links)
        .id((d) => d.id)
        .distance(60)
        .strength(0.3))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(18))
      .alphaDecay(0.025);

    simulationRef.current = simulation;

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(d3Links)
      .enter()
      .append('line')
      .attr('stroke', (d) => {
        const src = typeof d.source === 'string' ? d.source : d.source.id;
        const tgt = typeof d.target === 'string' ? d.target : d.target.id;
        const srcNode = nodeMap.get(src);
        const tgtNode = nodeMap.get(tgt);
        return srcNode?.isSuspicious || tgtNode?.isSuspicious
          ? 'hsl(0 84% 58% / 0.35)'
          : 'hsl(228 18% 28%)';
      })
      .attr('stroke-width', 1)
      .attr('marker-end', (d) => {
        const src = typeof d.source === 'string' ? d.source : d.source.id;
        const srcNode = nodeMap.get(src);
        return srcNode?.isSuspicious ? 'url(#arrowhead-suspicious)' : 'url(#arrowhead)';
      });

    // Nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(d3Nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => nodeRadius(nodes.get(d.id)!, d.isSuspicious))
      .attr('fill', (d) => scoreColor(d.suspicionScore))
      .attr('stroke', (d) => d.isSuspicious ? 'hsl(0 84% 80%)' : 'hsl(228 18% 35%)')
      .attr('stroke-width', (d) => d.isSuspicious ? 1.5 : 0.5)
      .attr('filter', (d) => d.suspicionScore >= 60 ? 'url(#glow)' : 'none')
      .attr('opacity', 0.9)
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGCircleElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('mouseenter', (event, d) => {
        const graphNode = nodes.get(d.id);
        if (!graphNode) return;
        const rect = svgEl.getBoundingClientRect();
        setTooltip({
          visible: true,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          node: graphNode,
        });
      })
      .on('mousemove', (event) => {
        const rect = svgEl.getBoundingClientRect();
        setTooltip((prev) => ({ ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top }));
      })
      .on('mouseleave', () => {
        setTooltip((prev) => ({ ...prev, visible: false }));
      });

    // Labels for suspicious nodes
    g.append('g')
      .selectAll('text')
      .data(d3Nodes.filter((d) => d.isSuspicious && d.suspicionScore >= 40))
      .enter()
      .append('text')
      .attr('font-size', '7px')
      .attr('fill', 'hsl(210 40% 80%)')
      .attr('text-anchor', 'middle')
      .attr('dy', '-12px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text((d) => d.id.length > 12 ? d.id.slice(0, 10) + '…' : d.id);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      g.selectAll('text')
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges]);

  return (
    <div className="relative w-full" style={{ height: '560px' }}>
      <div ref={containerRef} className="absolute inset-0 glass-card overflow-hidden rounded-lg">
        <svg ref={svgRef} className="w-full h-full" />

        {/* Tooltip */}
        {tooltip.visible && tooltip.node && (
          <div
            className="pointer-events-none absolute z-20 glass-card border border-border shadow-2xl p-3 min-w-48 max-w-64"
            style={{
              left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth ?? 600) - 280),
              top: Math.min(tooltip.y - 8, (containerRef.current?.clientHeight ?? 400) - 200),
            }}
          >
            <p className="font-mono text-xs text-primary font-bold mb-2">{tooltip.node.id}</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Suspicion Score</span>
                <span
                  className="text-xs font-bold font-mono"
                  style={{ color: scoreColor(tooltip.node.suspicionScore) }}
                >
                  {tooltip.node.suspicionScore.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Transactions</span>
                <span className="text-xs font-mono text-foreground">{tooltip.node.totalTransactions}</span>
              </div>
              {tooltip.node.ringId && (
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Ring ID</span>
                  <span className="text-xs font-mono" style={{ color: 'hsl(38 95% 55%)' }}>{tooltip.node.ringId}</span>
                </div>
              )}
            </div>
            {tooltip.node.detectedPatterns.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tooltip.node.detectedPatterns.map((p) => (
                  <span key={p} className={`pattern-tag pattern-tag-${p.split('_')[0]}`}>{p}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          <button
            onClick={resetZoom}
            className="glass-card p-2 hover:border-primary/50 transition-all"
            title="Reset zoom"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 glass-card p-3 flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Legend</p>
          {[
            { color: 'hsl(0 84% 58%)', label: 'High Risk (≥60)' },
            { color: 'hsl(38 95% 55%)', label: 'Medium Risk (30–59)' },
            { color: 'hsl(220 60% 55%)', label: 'Low Risk / Normal' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="absolute top-3 left-3 glass-card px-3 py-2">
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-mono">{nodeCount}</span> nodes ·{' '}
            <span className="text-foreground font-mono">{edgeCount}</span> edges
            {nodes.size > 300 && (
              <span className="ml-1 text-warning" style={{ color: 'hsl(38 95% 55%)' }}>
                (top {nodeCount} shown)
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
