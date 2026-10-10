async function getLatest() {
    return [{id: '1', title: 'The Beginning After The End', cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400', type: 'Web Novel'}];
}
async function search(query) {
    return [{id: '1', title: 'The Beginning After The End', cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400', type: 'Web Novel'}];
}
async function getChapters(id) {
    return [{id: 'ch1', chapter: '1', title: 'Prologue'}];
}
async function read(chapterId) {
    return {content: '<p>Ini adalah isi Web Novel chapter 1. Text will go here.</p>'};
}
module.exports = { getLatest, search, getChapters, read };
