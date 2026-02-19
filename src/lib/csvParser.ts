import Papa from 'papaparse';
import { RawTransaction, Transaction, ParseResult, ValidationError } from '@/types';

const REQUIRED_COLUMNS = [
  'transaction_id',
  'sender_id',
  'receiver_id',
  'amount',
  'timestamp',
] as const;

const TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function parseTimestamp(ts: string): number | null {
  if (!TIMESTAMP_REGEX.test(ts.trim())) return null;
  // Replace space with T for ISO 8601 parse
  const parsed = new Date(ts.trim().replace(' ', 'T') + 'Z');
  if (isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

export async function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const errors: ValidationError[] = [];
        const transactions: Transaction[] = [];

        // Check columns
        const headers: string[] = result.meta.fields ?? [];
        const missingCols = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
        if (missingCols.length > 0) {
          resolve({
            success: false,
            transactions: [],
            errors: [
              {
                message: `Missing required columns: ${missingCols.join(', ')}. Found: ${headers.join(', ')}`,
              },
            ],
            rowCount: 0,
          });
          return;
        }

        const extraCols = headers.filter((h) => !REQUIRED_COLUMNS.includes(h as any));
        // Extra columns are allowed (we just ignore them)

        // Validate rows
        (result.data as Record<string, string>[]).forEach((row, i) => {
          const rowNum = i + 2; // 1-indexed + header

          const txId = String(row.transaction_id ?? '').trim();
          const senderId = String(row.sender_id ?? '').trim();
          const receiverId = String(row.receiver_id ?? '').trim();
          const amountStr = String(row.amount ?? '').trim();
          const timestampStr = String(row.timestamp ?? '').trim();

          if (!txId) {
            errors.push({ row: rowNum, field: 'transaction_id', message: `Row ${rowNum}: transaction_id is empty` });
            return;
          }
          if (!senderId) {
            errors.push({ row: rowNum, field: 'sender_id', message: `Row ${rowNum}: sender_id is empty` });
            return;
          }
          if (!receiverId) {
            errors.push({ row: rowNum, field: 'receiver_id', message: `Row ${rowNum}: receiver_id is empty` });
            return;
          }

          const amount = parseFloat(amountStr);
          if (isNaN(amount) || amount <= 0) {
            errors.push({ row: rowNum, field: 'amount', message: `Row ${rowNum}: amount "${amountStr}" is not a valid positive number` });
            return;
          }

          const timestampMs = parseTimestamp(timestampStr);
          if (timestampMs === null) {
            errors.push({
              row: rowNum,
              field: 'timestamp',
              message: `Row ${rowNum}: timestamp "${timestampStr}" must be YYYY-MM-DD HH:MM:SS`,
            });
            return;
          }

          transactions.push({
            transaction_id: txId,
            sender_id: senderId,
            receiver_id: receiverId,
            amount,
            timestamp: timestampStr,
            timestampMs,
          });
        });

        // Stop early if too many errors
        if (errors.length > 20) {
          resolve({
            success: false,
            transactions: [],
            errors: [
              ...errors.slice(0, 10),
              { message: `...and ${errors.length - 10} more errors. Please check your CSV file format.` },
            ],
            rowCount: result.data.length,
          });
          return;
        }

        if (errors.length > 0) {
          resolve({
            success: false,
            transactions: [],
            errors,
            rowCount: result.data.length,
          });
          return;
        }

        resolve({
          success: true,
          transactions,
          errors: [],
          rowCount: transactions.length,
        });
      },
      error: (err) => {
        resolve({
          success: false,
          transactions: [],
          errors: [{ message: `CSV parse error: ${err.message}` }],
          rowCount: 0,
        });
      },
    });
  });
}
