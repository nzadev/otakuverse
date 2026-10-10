async function getLatest() {
    return [{id: '1', title: 'Solo Leveling (LN)', cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400', type: 'Light Novel'}];
}
async function search(query) {
    return [{id: '1', title: 'Solo Leveling (LN)', cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400', type: 'Light Novel'}];
}
async function getChapters(id) {
    return [{id: 'ch1', chapter: '1', title: 'Prologue'}];
}
async function read(chapterId) {
    return {content: '<p>Ini adalah isi Light Novel chapter 1. Text will go here.</p>'};
}
module.exports = { getLatest, search, getChapters, read };
