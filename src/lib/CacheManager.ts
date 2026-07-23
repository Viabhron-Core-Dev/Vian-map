import { db } from './db';
import { useConfigStore } from './store';

export const CacheManager = {
  /**
   * Run cleanup tasks based on configuration
   */
  async performCleanup() {
    const { cacheMaxTiles, cacheMaxAgeDays, cacheAutoClean } = useConfigStore.getState();
    
    if (!cacheAutoClean) return;

    try {
      // 1. Cleanup by age
      const now = Date.now();
      const maxAgeMs = cacheMaxAgeDays * 24 * 60 * 60 * 1000;
      const cutoff = now - maxAgeMs;
      
      const oldTiles = await db.tiles
        .where('timestamp')
        .below(cutoff)
        .keys();
        
      if (oldTiles.length > 0) {
        console.log(`[CacheManager] Pruning ${oldTiles.length} expired tiles`);
        await db.tiles.bulkDelete(oldTiles);
      }

      // 2. Cleanup by count (LRU-ish)
      const totalCount = await db.tiles.count();
      if (totalCount > cacheMaxTiles) {
        const overflow = totalCount - cacheMaxTiles;
        console.log(`[CacheManager] Cache overflow: ${totalCount}/${cacheMaxTiles}. Pruning ${overflow} oldest tiles.`);
        
        const overFlowTiles = await db.tiles
          .orderBy('timestamp')
          .limit(overflow)
          .keys();
          
        await db.tiles.bulkDelete(overFlowTiles);
      }
    } catch (error) {
      console.error('[CacheManager] Cleanup failed:', error);
    }
  },

  /**
   * Estimation of cache size in bytes
   */
  async estimateCacheSize() {
    let size = 0;
    try {
      await db.tiles.each(tile => {
        size += tile.data.size;
      });
    } catch (e) {
      console.error('Failed to estimate size:', e);
    }
    return size;
  }
};
