export type BehaviorSettings = {
  tenantId: string;
  readingSpeedWPM: number;
  streamingChunkSize: number;
  artificialDelayMs: number;
  humanizerEnabled: boolean;
  typoRate: number;
  pauseBeforeReplyMs: number;
  typingSpeedVariance: number;
  allowedExpressions: string;
  forbiddenExpressions: string;
  intermittentTyping: boolean;
};
