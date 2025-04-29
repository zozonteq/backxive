export function parseWaybackTimestamp(timestamp: string): Date {
  if (!/^\d{14}$/.test(timestamp)) {
    throw new Error('Invalid timestamp format. Expected YYYYMMDDHHMMSS');
  }

  return new Date(
    `${timestamp.substring(0, 4)}-${timestamp.substring(4, 6)}-${timestamp.substring(6, 8)}T${timestamp.substring(8, 10)}:${timestamp.substring(10, 12)}:${timestamp.substring(12, 14)}Z`
  );
} 