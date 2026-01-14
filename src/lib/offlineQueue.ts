import { db, MutationRecord } from './db';
import { v4 as uuidv4 } from 'uuid';

/**
 * OFFLINE MUTATION QUEUE
 * 
 * Enqueues all writes (INSERT, UPDATE, DELETE) when offline.
 * On reconnect, syncs with Supabase.
 * 
 * Each mutation is idempotent — can be replayed safely.
 */

export type MutationTable = 'products' | 'sales' | 'notifications' | 'settings' | 'images';
export type MutationOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Enqueue a mutation
 */
export async function enqueueMutation(
  table: MutationTable,
  operation: MutationOperation,
  recordId: string,
  payload: Record<string, any>
): Promise<MutationRecord> {
  const clientId = localStorage.getItem('mbodze_client_id') || 'unknown';
  
  const mutation: MutationRecord = {
    id: uuidv4(),
    clientId,
    table,
    operation,
    recordId,
    payload,
    timestamp: Date.now(),
    status: 'pending',
    retries: 0,
  };

  await db.mutations.add(mutation);
  console.log(`📝 Mutation queued (${operation} ${table}/${recordId}):`, mutation.id);
  
  return mutation;
}

/**
 * Get all pending mutations (for sync)
 */
export async function getPendingMutations(): Promise<MutationRecord[]> {
  return db.mutations.where('status').equals('pending').toArray();
}

/**
 * Get pending mutations for a specific table
 */
export async function getPendingMutationsForTable(table: MutationTable): Promise<MutationRecord[]> {
  return db.mutations.where('table').equals(table).and((m) => m.status === 'pending').toArray();
}

/**
 * Mark mutation as synced
 */
export async function markMutationSynced(mutationId: string) {
  await db.mutations.update(mutationId, {
    status: 'synced',
  });
  console.log('✅ Mutation synced:', mutationId);
}

/**
 * Mark mutation as failed and increment retry count
 */
export async function markMutationFailed(mutationId: string, error: string) {
  const mutation = await db.mutations.get(mutationId);
  if (!mutation) return;

  const newRetries = mutation.retries + 1;
  const maxRetries = 5;
  const status = newRetries >= maxRetries ? 'failed' : 'pending';

  await db.mutations.update(mutationId, {
    status,
    retries: newRetries,
    lastError: error,
  });

  console.log(`⚠️ Mutation failed (retry ${newRetries}/${maxRetries}):`, mutationId);
}

/**
 * Clear all synced mutations (after successful sync)
 */
export async function clearSyncedMutations() {
  await db.mutations.where('status').equals('synced').delete();
  console.log('🧹 Cleared synced mutations');
}

/**
 * Get failed mutations (for manual retry/intervention)
 */
export async function getFailedMutations(): Promise<MutationRecord[]> {
  return db.mutations.where('status').equals('failed').toArray();
}

/**
 * Retry a failed mutation
 */
export async function retryFailedMutation(mutationId: string) {
  await db.mutations.update(mutationId, {
    status: 'pending',
    retries: 0,
    lastError: undefined,
  });
  console.log('🔄 Retrying mutation:', mutationId);
}

/**
 * Delete a failed mutation (manual cleanup)
 */
export async function deleteMutation(mutationId: string) {
  await db.mutations.delete(mutationId);
  console.log('🗑️ Deleted mutation:', mutationId);
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const pending = await db.mutations.where('status').equals('pending').count();
  const synced = await db.mutations.where('status').equals('synced').count();
  const failed = await db.mutations.where('status').equals('failed').count();

  return {
    pending,
    synced,
    failed,
    total: pending + synced + failed,
  };
}
