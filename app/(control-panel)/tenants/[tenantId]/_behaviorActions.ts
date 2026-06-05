'use server';

import { BehaviorSettings } from "./_behaviorTypes";
import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getBehaviorSettings(tenantId: string): Promise<BehaviorSettings | null> {
  try {
    const res = await pool.query(
      `SELECT reading_speed_wpm, streaming_chunk_size, artificial_delay_ms, 
              humanizer_enabled, typo_rate, pause_before_reply_ms, typing_speed_variance,
              allowed_expressions, forbidden_expressions, intermittent_typing
       FROM tenant_behavior_settings WHERE tenant_id = $1`,
      [tenantId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const data = res.rows[0];
    
    // Parse json arrays into comma separated strings for the frontend
    const allowed = Array.isArray(data.allowed_expressions) ? data.allowed_expressions.join(', ') : '';
    const forbidden = Array.isArray(data.forbidden_expressions) ? data.forbidden_expressions.join(', ') : '';

    return {
      tenantId,
      readingSpeedWPM: data.reading_speed_wpm,
      streamingChunkSize: data.streaming_chunk_size,
      artificialDelayMs: data.artificial_delay_ms,
      humanizerEnabled: data.humanizer_enabled,
      typoRate: data.typo_rate,
      pauseBeforeReplyMs: data.pause_before_reply_ms,
      typingSpeedVariance: data.typing_speed_variance,
      allowedExpressions: allowed,
      forbiddenExpressions: forbidden,
      intermittentTyping: data.intermittent_typing || false,
    };
  } catch (error: any) {
    console.error('Error fetching behavior settings:', error);
    return null;
  }
}

export async function saveBehaviorSettings(data: BehaviorSettings) {
  const { 
    tenantId, 
    readingSpeedWPM, 
    streamingChunkSize, 
    artificialDelayMs,
    humanizerEnabled,
    typoRate,
    pauseBeforeReplyMs,
    typingSpeedVariance,
    allowedExpressions,
    forbiddenExpressions,
    intermittentTyping
  } = data;

  try {
    // Transform comma-separated strings back to arrays
    const allowedArr = allowedExpressions ? allowedExpressions.split(',').map(s => s.trim()).filter(Boolean) : [];
    const forbiddenArr = forbiddenExpressions ? forbiddenExpressions.split(',').map(s => s.trim()).filter(Boolean) : [];

    await pool.query(
      `INSERT INTO tenant_behavior_settings (
        tenant_id,
        reading_speed_wpm,
        streaming_chunk_size,
        artificial_delay_ms,
        humanizer_enabled,
        typo_rate,
        pause_before_reply_ms,
        typing_speed_variance,
        allowed_expressions,
        forbidden_expressions,
        intermittent_typing
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (tenant_id) DO UPDATE SET
        reading_speed_wpm = EXCLUDED.reading_speed_wpm,
        streaming_chunk_size = EXCLUDED.streaming_chunk_size,
        artificial_delay_ms = EXCLUDED.artificial_delay_ms,
        humanizer_enabled = EXCLUDED.humanizer_enabled,
        typo_rate = EXCLUDED.typo_rate,
        pause_before_reply_ms = EXCLUDED.pause_before_reply_ms,
        typing_speed_variance = EXCLUDED.typing_speed_variance,
        allowed_expressions = EXCLUDED.allowed_expressions,
        forbidden_expressions = EXCLUDED.forbidden_expressions,
        intermittent_typing = EXCLUDED.intermittent_typing,
        updated_at = NOW()
      `,
      [
        tenantId, readingSpeedWPM, streamingChunkSize, artificialDelayMs, 
        humanizerEnabled, typoRate, pauseBeforeReplyMs, typingSpeedVariance,
        JSON.stringify(allowedArr), JSON.stringify(forbiddenArr), intermittentTyping
      ]
    );

    revalidatePath(`/control-panel/tenants/${tenantId}`);
    return { success: true, message: 'Behavior settings updated successfully!' };
  } catch (error) {
    console.error('Error saving behavior settings:', error);
    return { success: false, message: 'Failed to save behavior settings.' };
  }
}
