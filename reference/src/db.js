/* db.js — IndexedDB via Dexie */

export const mapDB = new Dexie('OfflineMapDB');
mapDB.version(3).stores({
    tiles:     'id, timestamp',
    bookmarks: '++id, name, category, savedAt',
    overlays:  '++id, name'
});

/* ── Tiles ── */
export async function saveTile(key, blob) {
    try {
        await mapDB.tiles.put({ id: key, data: blob, timestamp: Date.now() });
    } catch (e) {
        console.warn('saveTile failed (storage full?):', e);
    }
}
export async function getTile(key)          { return await mapDB.tiles.get(key); }
export async function deleteTile(key)       { return await mapDB.tiles.delete(key); }
export async function getTileCount()        { return await mapDB.tiles.count(); }
export async function clearOldTiles(days)   {
    var limit = Date.now() - ((days || 30) * 86400000);
    return await mapDB.tiles.where('timestamp').below(limit).delete();
}

/* ── Bookmarks ── */
export async function saveBookmark(name, lat, lng, category, note) {
    return await mapDB.bookmarks.add({
        name:      name     || 'Untitled',
        lat:       lat,
        lng:       lng,
        category:  category || 'other',
        note:      note     || '',
        savedAt:   Date.now()
    });
}

export async function getAllBookmarks() {
    return await mapDB.bookmarks.orderBy('savedAt').reverse().toArray();
}

export async function deleteBookmark(id) {
    return await mapDB.bookmarks.delete(id);
}

export async function updateBookmark(id, fields) {
    return await mapDB.bookmarks.update(id, fields);
}
