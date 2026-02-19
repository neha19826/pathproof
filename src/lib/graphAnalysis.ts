import {
  Transaction,
  GraphNode,
  GraphEdge,
  PatternType,
  FraudRing,
  SuspiciousAccount,
  AnalysisResult,
} from '@/types';

// =============================================
// Graph Building
// =============================================
function buildGraph(transactions: Transaction[]): {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  adjacency: Map<string, Set<string>>;
  reverseAdj: Map<string, Set<string>>;
  edgesByTime: GraphEdge[];
} {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const adjacency = new Map<string, Set<string>>();
  const reverseAdj = new Map<string, Set<string>>();

  function ensureNode(id: string): GraphNode {
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        totalTransactions: 0,
        totalSent: 0,
        totalReceived: 0,
        uniqueSenders: new Set(),
        uniqueReceivers: new Set(),
        isSuspicious: false,
        suspicionScore: 0,
        detectedPatterns: [],
      });
    }
    return nodes.get(id)!;
  }

  for (const tx of transactions) {
    const sender = ensureNode(tx.sender_id);
    const receiver = ensureNode(tx.receiver_id);

    sender.totalTransactions++;
    sender.totalSent += tx.amount;
    sender.uniqueReceivers.add(tx.receiver_id);

    receiver.totalTransactions++;
    receiver.totalReceived += tx.amount;
    receiver.uniqueSenders.add(tx.sender_id);

    edges.push({
      source: tx.sender_id,
      target: tx.receiver_id,
      amount: tx.amount,
      timestamp: tx.timestampMs,
      transactionId: tx.transaction_id,
    });

    if (!adjacency.has(tx.sender_id)) adjacency.set(tx.sender_id, new Set());
    adjacency.get(tx.sender_id)!.add(tx.receiver_id);

    if (!reverseAdj.has(tx.receiver_id)) reverseAdj.set(tx.receiver_id, new Set());
    reverseAdj.get(tx.receiver_id)!.add(tx.sender_id);
  }

  const edgesByTime = [...edges].sort((a, b) => a.timestamp - b.timestamp);
  return { nodes, edges, adjacency, reverseAdj, edgesByTime };
}

// =============================================
// Cycle Detection (DFS — length 3 to 5)
// =============================================
interface CycleResult {
  cycles: string[][];
}

function detectCycles(
  adjacency: Map<string, Set<string>>,
  nodeIds: string[]
): CycleResult {
  const cycles: string[][] = [];
  const seenCycles = new Set<string>();

  // DFS from each node
  for (const start of nodeIds) {
    const path: string[] = [start];
    const visited = new Set<string>([start]);

    function dfs(current: string, depth: number) {
      if (depth > 5) return;
      const neighbors = adjacency.get(current) ?? new Set();
      for (const neighbor of neighbors) {
        if (neighbor === start && depth >= 3) {
          // Found cycle
          const cycle = [...path];
          const key = [...cycle].sort().join('|');
          if (!seenCycles.has(key)) {
            seenCycles.add(key);
            cycles.push(cycle);
          }
          continue;
        }
        if (!visited.has(neighbor) && depth < 5) {
          visited.add(neighbor);
          path.push(neighbor);
          dfs(neighbor, depth + 1);
          path.pop();
          visited.delete(neighbor);
        }
      }
    }

    dfs(start, 1);
  }

  return { cycles };
}

// =============================================
// Smurfing Detection (Fan-in / Fan-out)
// =============================================
const SMURF_THRESHOLD = 10;
const SMURF_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours

interface SmurfResult {
  fanInAccounts: Set<string>; // receivers with 10+ unique senders in 72h
  fanOutAccounts: Set<string>; // senders with 10+ unique receivers in 72h
}

function detectSmurfing(edges: GraphEdge[]): SmurfResult {
  const fanInAccounts = new Set<string>();
  const fanOutAccounts = new Set<string>();

  // Group edges by receiver (for fan-in) and sender (for fan-out)
  const byReceiver = new Map<string, GraphEdge[]>();
  const bySender = new Map<string, GraphEdge[]>();

  for (const edge of edges) {
    if (!byReceiver.has(edge.target)) byReceiver.set(edge.target, []);
    byReceiver.get(edge.target)!.push(edge);

    if (!bySender.has(edge.source)) bySender.set(edge.source, []);
    bySender.get(edge.source)!.push(edge);
  }

  // Fan-in: receiver gets from 10+ unique senders within 72h
  for (const [receiver, rxEdges] of byReceiver) {
    const sorted = rxEdges.sort((a, b) => a.timestamp - b.timestamp);
    // Sliding window
    let left = 0;
    for (let right = 0; right < sorted.length; right++) {
      while (sorted[right].timestamp - sorted[left].timestamp > SMURF_WINDOW_MS) {
        left++;
      }
      const window = sorted.slice(left, right + 1);
      const uniqueSenders = new Set(window.map((e) => e.source));
      if (uniqueSenders.size >= SMURF_THRESHOLD) {
        fanInAccounts.add(receiver);
        break;
      }
    }
  }

  // Fan-out: sender sends to 10+ unique receivers within 72h
  for (const [sender, txEdges] of bySender) {
    const sorted = txEdges.sort((a, b) => a.timestamp - b.timestamp);
    let left = 0;
    for (let right = 0; right < sorted.length; right++) {
      while (sorted[right].timestamp - sorted[left].timestamp > SMURF_WINDOW_MS) {
        left++;
      }
      const window = sorted.slice(left, right + 1);
      const uniqueReceivers = new Set(window.map((e) => e.target));
      if (uniqueReceivers.size >= SMURF_THRESHOLD) {
        fanOutAccounts.add(sender);
        break;
      }
    }
  }

  return { fanInAccounts, fanOutAccounts };
}

// =============================================
// Layered Shell Network Detection
// =============================================
const SHELL_MIN_HOPS = 3;
const SHELL_MAX_TX = 3; // intermediate node max total transactions

interface ShellResult {
  shellAccounts: Set<string>;
}

function detectShellChains(
  nodes: Map<string, GraphNode>,
  adjacency: Map<string, Set<string>>
): ShellResult {
  const shellAccounts = new Set<string>();

  // Find chains where intermediate nodes have 2-3 total transactions
  for (const [startId, startNode] of nodes) {
    // BFS/DFS to find chains of 3+ hops through shell-like intermediates
    const visited = new Set<string>([startId]);
    const queue: { id: string; depth: number; chain: string[] }[] = [
      { id: startId, depth: 0, chain: [startId] },
    ];

    while (queue.length > 0) {
      const { id, depth, chain } = queue.shift()!;
      const neighbors = adjacency.get(id) ?? new Set();

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        const nNode = nodes.get(neighbor);
        if (!nNode) continue;

        const isShellIntermediate =
          nNode.totalTransactions >= 2 &&
          nNode.totalTransactions <= SHELL_MAX_TX;

        if (depth >= SHELL_MIN_HOPS - 1 && chain.length >= SHELL_MIN_HOPS) {
          // Found a valid chain — flag all members
          for (const acc of chain) {
            shellAccounts.add(acc);
          }
          shellAccounts.add(neighbor);
        }

        if (isShellIntermediate && depth < 6) {
          visited.add(neighbor);
          queue.push({
            id: neighbor,
            depth: depth + 1,
            chain: [...chain, neighbor],
          });
        }
      }
    }
  }

  return { shellAccounts };
}

// =============================================
// High Velocity Detection
// =============================================
const VELOCITY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const VELOCITY_MIN_TX = 20; // 20+ transactions in 24h

function detectHighVelocity(
  edges: GraphEdge[]
): Set<string> {
  const highVelocity = new Set<string>();
  const bySender = new Map<string, number[]>();

  for (const edge of edges) {
    if (!bySender.has(edge.source)) bySender.set(edge.source, []);
    bySender.get(edge.source)!.push(edge.timestamp);
  }

  for (const [sender, timestamps] of bySender) {
    const sorted = timestamps.sort((a, b) => a - b);
    let left = 0;
    for (let right = 0; right < sorted.length; right++) {
      while (sorted[right] - sorted[left] > VELOCITY_WINDOW_MS) left++;
      if (right - left + 1 >= VELOCITY_MIN_TX) {
        highVelocity.add(sender);
        break;
      }
    }
  }

  return highVelocity;
}

// =============================================
// Suspicion Scoring
// =============================================
const SCORES = {
  cycle: 40,
  fanIn: 25,
  fanOut: 25,
  shell: 20,
  velocity: 10,
} as const;

function scoreAccounts(
  nodes: Map<string, GraphNode>,
  cycleNodes: Map<string, { length: number; ringId: string }>,
  fanInAccounts: Set<string>,
  fanOutAccounts: Set<string>,
  shellAccounts: Set<string>,
  highVelocity: Set<string>
): void {
  for (const [id, node] of nodes) {
    let score = 0;
    const patterns: PatternType[] = [];

    if (cycleNodes.has(id)) {
      const info = cycleNodes.get(id)!;
      score += SCORES.cycle;
      patterns.push(`cycle_length_${info.length}` as PatternType);
      node.ringId = info.ringId;
    }
    if (fanInAccounts.has(id)) {
      score += SCORES.fanIn;
      patterns.push('fan_in');
    }
    if (fanOutAccounts.has(id)) {
      score += SCORES.fanOut;
      patterns.push('fan_out');
    }
    if (shellAccounts.has(id)) {
      score += SCORES.shell;
      patterns.push('shell_chain');
    }
    if (highVelocity.has(id)) {
      score += SCORES.velocity;
      patterns.push('high_velocity');
    }

    // Normalize to max 100
    node.suspicionScore = Math.min(100, score);
    node.detectedPatterns = patterns;
    node.isSuspicious = score > 0;
  }
}

// =============================================
// False Positive Filtering
// =============================================
function filterFalsePositives(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[]
): void {
  // Legitimate high-volume merchants: high degree but symmetric (both fan-in AND fan-out patterns as normal commerce)
  // We identify "merchants" as nodes with very high volume but structured (consistent amounts → payroll)
  
  // Payroll: nodes that send consistent small-variance amounts to many receivers
  const bySender = new Map<string, number[]>();
  for (const edge of edges) {
    if (!bySender.has(edge.source)) bySender.set(edge.source, []);
    bySender.get(edge.source)!.push(edge.amount);
  }

  for (const [sender, amounts] of bySender) {
    const node = nodes.get(sender);
    if (!node) continue;
    // Payroll: 10+ transactions with very low coefficient of variation (<5%)
    if (amounts.length >= 10) {
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const std = Math.sqrt(amounts.map((x) => (x - mean) ** 2).reduce((a, b) => a + b, 0) / amounts.length);
      const cv = mean > 0 ? std / mean : 0;
      if (cv < 0.05) {
        // This is likely payroll — remove fan-out flag if it has no cycle
        if (!node.detectedPatterns.includes('fan_out') || node.detectedPatterns.some(p => p.startsWith('cycle'))) {
          continue; // keep cycle-based flags
        }
        // Remove fan_out for payroll
        node.detectedPatterns = node.detectedPatterns.filter((p) => p !== 'fan_out');
        node.suspicionScore = Math.max(0, node.suspicionScore - SCORES.fanOut);
        if (node.detectedPatterns.length === 0) {
          node.isSuspicious = false;
          node.suspicionScore = 0;
        }
      }
    }
  }
}

// =============================================
// Fraud Ring Assembly
// =============================================
let ringCounter = 0;

function assembleFraudRings(
  cycles: string[][],
  fanInAccounts: Set<string>,
  fanOutAccounts: Set<string>,
  shellAccounts: Set<string>,
  nodes: Map<string, GraphNode>
): FraudRing[] {
  ringCounter = 0;
  const rings: FraudRing[] = [];
  const ringIdMap = new Map<string, string>(); // account → ringId

  // Cycle rings
  const cycleGroups = new Map<string, Set<string>>();
  for (const cycle of cycles) {
    // Try to merge overlapping cycles
    let mergedRingId: string | null = null;
    for (const acc of cycle) {
      if (ringIdMap.has(acc)) {
        mergedRingId = ringIdMap.get(acc)!;
        break;
      }
    }
    if (!mergedRingId) {
      mergedRingId = `RING_${String(++ringCounter).padStart(3, '0')}`;
      cycleGroups.set(mergedRingId, new Set());
    }
    const group = cycleGroups.get(mergedRingId)!;
    for (const acc of cycle) {
      group.add(acc);
      ringIdMap.set(acc, mergedRingId);
    }
  }

  for (const [ringId, members] of cycleGroups) {
    const memberArr = Array.from(members);
    const avgScore =
      memberArr.reduce((sum, acc) => sum + (nodes.get(acc)?.suspicionScore ?? 0), 0) / memberArr.length;
    rings.push({
      ring_id: ringId,
      member_accounts: memberArr,
      pattern_type: 'cycle',
      risk_score: Math.round(avgScore * 10) / 10,
    });
    // Update node ring IDs
    for (const acc of memberArr) {
      const node = nodes.get(acc);
      if (node) node.ringId = ringId;
    }
  }

  // Fan-in rings
  const fanInArr = Array.from(fanInAccounts).filter((acc) => !ringIdMap.has(acc));
  if (fanInArr.length > 0) {
    const ringId = `RING_${String(++ringCounter).padStart(3, '0')}`;
    const avgScore = fanInArr.reduce((sum, acc) => sum + (nodes.get(acc)?.suspicionScore ?? 0), 0) / fanInArr.length;
    rings.push({
      ring_id: ringId,
      member_accounts: fanInArr,
      pattern_type: 'fan_in',
      risk_score: Math.round(avgScore * 10) / 10,
    });
    for (const acc of fanInArr) {
      const node = nodes.get(acc);
      if (node && !node.ringId) node.ringId = ringId;
    }
  }

  // Fan-out rings
  const fanOutArr = Array.from(fanOutAccounts).filter((acc) => !ringIdMap.has(acc) && !fanInAccounts.has(acc));
  if (fanOutArr.length > 0) {
    const ringId = `RING_${String(++ringCounter).padStart(3, '0')}`;
    const avgScore = fanOutArr.reduce((sum, acc) => sum + (nodes.get(acc)?.suspicionScore ?? 0), 0) / fanOutArr.length;
    rings.push({
      ring_id: ringId,
      member_accounts: fanOutArr,
      pattern_type: 'fan_out',
      risk_score: Math.round(avgScore * 10) / 10,
    });
    for (const acc of fanOutArr) {
      const node = nodes.get(acc);
      if (node && !node.ringId) node.ringId = ringId;
    }
  }

  // Shell chain rings
  const shellArr = Array.from(shellAccounts).filter(
    (acc) => !ringIdMap.has(acc) && !fanInAccounts.has(acc) && !fanOutAccounts.has(acc)
  );
  if (shellArr.length > 0) {
    const ringId = `RING_${String(++ringCounter).padStart(3, '0')}`;
    const avgScore = shellArr.reduce((sum, acc) => sum + (nodes.get(acc)?.suspicionScore ?? 0), 0) / shellArr.length;
    rings.push({
      ring_id: ringId,
      member_accounts: shellArr,
      pattern_type: 'shell_chain',
      risk_score: Math.round(avgScore * 10) / 10,
    });
    for (const acc of shellArr) {
      const node = nodes.get(acc);
      if (node && !node.ringId) node.ringId = ringId;
    }
  }

  return rings;
}

// =============================================
// MAIN ANALYSIS ENTRY POINT
// =============================================
export function analyzeTransactions(
  transactions: Transaction[]
): AnalysisResult {
  const startTime = performance.now();

  // 1. Build graph
  const { nodes, edges, adjacency } = buildGraph(transactions);
  const nodeIds = Array.from(nodes.keys());

  // 2. Detect cycles (length 3-5)
  const { cycles } = detectCycles(adjacency, nodeIds);

  // Build cycleNodes map (account → { length, ringId placeholder })
  const cycleNodes = new Map<string, { length: number; ringId: string }>();
  for (const cycle of cycles) {
    const len = cycle.length;
    for (const acc of cycle) {
      if (!cycleNodes.has(acc) || cycleNodes.get(acc)!.length > len) {
        cycleNodes.set(acc, { length: len, ringId: '' }); // ringId filled later
      }
    }
  }

  // 3. Smurfing
  const { fanInAccounts, fanOutAccounts } = detectSmurfing(edges);

  // 4. Shell chains
  const { shellAccounts } = detectShellChains(nodes, adjacency);

  // 5. High velocity
  const highVelocity = detectHighVelocity(edges);

  // 6. Score
  scoreAccounts(nodes, cycleNodes, fanInAccounts, fanOutAccounts, shellAccounts, highVelocity);

  // 7. False positive filtering
  filterFalsePositives(nodes, edges);

  // 8. Assemble fraud rings
  const fraudRings = assembleFraudRings(cycles, fanInAccounts, fanOutAccounts, shellAccounts, nodes);

  // 9. Build suspicious accounts list
  const suspiciousAccounts: SuspiciousAccount[] = Array.from(nodes.values())
    .filter((n) => n.isSuspicious && n.suspicionScore > 0)
    .sort((a, b) => b.suspicionScore - a.suspicionScore)
    .map((n) => ({
      account_id: n.id,
      suspicion_score: Math.round(n.suspicionScore * 10) / 10,
      detected_patterns: n.detectedPatterns,
      ring_id: n.ringId,
    }));

  const processingTime = (performance.now() - startTime) / 1000;

  return {
    suspicious_accounts: suspiciousAccounts,
    fraud_rings: fraudRings,
    summary: {
      total_accounts_analyzed: nodes.size,
      suspicious_accounts_flagged: suspiciousAccounts.length,
      fraud_rings_detected: fraudRings.length,
      processing_time_seconds: Math.round(processingTime * 100) / 100,
    },
    nodes,
    edges,
  };
}
