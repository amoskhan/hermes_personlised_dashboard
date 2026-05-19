import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

interface GraphData {
  nodes: { id: string; group: number; size: number }[]
  links: { source: string; target: string; count: number }[]
}

export default function ForceGraph({ data }: { data: GraphData }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return

    const w = containerRef.current?.clientWidth || 400
    const h = 300
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    svg.attr('width', w).attr('height', h)

    const color = (g: number) => g === 1 ? '#6366f1' : '#4a4a5a'

    const simulation = d3.forceSimulation(data.nodes as any)
      .force('link', d3.forceLink(data.links).id((d: any) => d.id).distance(60))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide().radius(12))

    const link = svg.append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke', '#2a2a4e')
      .attr('stroke-width', d => Math.min(d.count, 3))
      .attr('stroke-opacity', 0.5)

    const node = svg.append('g')
      .selectAll('circle')
      .data(data.nodes)
      .join('circle')
      .attr('r', d => Math.max(3, Math.min(d.size, 8)))
      .attr('fill', (d: any) => color(d.group))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .call(d3.drag<any, any>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
      )

    const label = svg.append('g')
      .selectAll('text')
      .data(data.nodes)
      .join('text')
      .text(d => d.id.replace('2026-', ''))
      .attr('font-size', 8)
      .attr('fill', '#aaa')
      .attr('dx', 8)
      .attr('dy', 3)

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)
      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y)
      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y)
    })

    return () => { simulation.stop() }
  }, [data])

  if (!data.nodes.length) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: '#555', fontSize: 13 }}>No vault data to graph</div>
  }

  return (
    <div ref={containerRef} style={{ width: '100%', borderRadius: 8, overflow: 'hidden' }}>
      <svg ref={svgRef} style={{ width: '100%', height: 300 }} />
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, justifyContent: 'center' }}>
        <span style={{ color: '#666' }}>🔵 {data.nodes.filter(n => n.group === 1).length} existing notes</span>
        <span style={{ color: '#666' }}>⚪ {data.nodes.filter(n => n.group === 2).length} external refs</span>
        <span style={{ color: '#666' }}>🔗 {data.links.length} connections</span>
      </div>
    </div>
  )
}
