import { AnalysisResult } from '@/types';

export function buildExportPayload(result: AnalysisResult) {
  return {
    suspicious_accounts: result.suspicious_accounts.map((acc) => ({
      account_id: acc.account_id,
      suspicion_score: acc.suspicion_score,
      detected_patterns: acc.detected_patterns,
      ...(acc.ring_id ? { ring_id: acc.ring_id } : {}),
    })),
    fraud_rings: result.fraud_rings.map((ring) => ({
      ring_id: ring.ring_id,
      member_accounts: ring.member_accounts,
      pattern_type: ring.pattern_type,
      risk_score: ring.risk_score,
    })),
    summary: { ...result.summary },
  };
}

export function downloadJSON(result: AnalysisResult, filename = 'fraud_detection_report.json') {
  const payload = buildExportPayload(result);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
