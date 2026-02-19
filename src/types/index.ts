// =============================================
// GRAPH-BASED FINANCIAL CRIME DETECTION ENGINE
// Core Type Definitions
// =============================================

export interface RawTransaction {
  transaction_id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  timestamp: string; // YYYY-MM-DD HH:MM:SS
}

export interface Transaction extends RawTransaction {
  timestampMs: number; // parsed epoch ms
}

// Graph node
export interface GraphNode {
  id: string;
  totalTransactions: number;
  totalSent: number;
  totalReceived: number;
  uniqueSenders: Set<string>;
  uniqueReceivers: Set<string>;
  isSuspicious: boolean;
  suspicionScore: number;
  detectedPatterns: PatternType[];
  ringId?: string;
}

// Graph edge
export interface GraphEdge {
  source: string;
  target: string;
  amount: number;
  timestamp: number; // epoch ms
  transactionId: string;
}

export type PatternType =
  | 'cycle_length_3'
  | 'cycle_length_4'
  | 'cycle_length_5'
  | 'fan_in'
  | 'fan_out'
  | 'shell_chain'
  | 'high_velocity';

export interface FraudRing {
  ring_id: string;
  member_accounts: string[];
  pattern_type: 'cycle' | 'fan_in' | 'fan_out' | 'shell_chain';
  risk_score: number;
}

export interface SuspiciousAccount {
  account_id: string;
  suspicion_score: number;
  detected_patterns: PatternType[];
  ring_id?: string;
}

export interface AnalysisSummary {
  total_accounts_analyzed: number;
  suspicious_accounts_flagged: number;
  fraud_rings_detected: number;
  processing_time_seconds: number;
}

export interface AnalysisResult {
  suspicious_accounts: SuspiciousAccount[];
  fraud_rings: FraudRing[];
  summary: AnalysisSummary;
  // Internal graph data (not in JSON export)
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

// D3 visualization types
export interface D3Node {
  id: string;
  suspicionScore: number;
  isSuspicious: boolean;
  detectedPatterns: PatternType[];
  ringId?: string;
  totalTransactions: number;
  // D3 simulation properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface D3Link {
  source: string | D3Node;
  target: string | D3Node;
  amount: number;
  transactionId: string;
}

export interface ValidationError {
  row?: number;
  field?: string;
  message: string;
}

export interface ParseResult {
  success: boolean;
  transactions: Transaction[];
  errors: ValidationError[];
  rowCount: number;
}
