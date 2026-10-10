const Gamification = {
  get state() {
    return JSON.parse(localStorage.getItem('otakuverse_gamification') || '{"xp":0, "level":1, "totalWatchTime":0}');
  },
  saveState(state) {
    localStorage.setItem('otakuverse_gamification', JSON.stringify(state));
    if (window.currentUser && window.db) {
      window.db.collection('users').doc(window.currentUser.uid).set({
        gamification: state,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(console.error);
    }
  },
  addExp(amount) {
    const s = this.state;
    s.xp += amount;
    
    // Formula: level = floor(sqrt(xp / 100)) + 1
    // (Unlimited levels)
    const newLevel = Math.floor(Math.sqrt(s.xp / 100)) + 1;
    
    if (newLevel > s.level) {
      const levelDiff = newLevel - s.level;
      s.level = newLevel;
      if (typeof showToast === 'function') {
        showToast(`🎉 Level Up! Kamu sekarang Level ${s.level} 🌟`);
      }
    }
    
    this.saveState(s);
    return s;
  },
  syncFromFirestore(data) {
    if (data && data.gamification) {
      const local = this.state;
      if (data.gamification.xp > local.xp) {
        this.saveState(data.gamification);
      }
    }
  },
  getLevelProgress() {
    const s = this.state;
    const currentLevelXp = Math.pow(s.level - 1, 2) * 100;
    const nextLevelXp = Math.pow(s.level, 2) * 100;
    const xpInLevel = s.xp - currentLevelXp;
    const xpRequired = nextLevelXp - currentLevelXp;
    const pct = (xpInLevel / xpRequired) * 100;
    return { currentLevelXp, nextLevelXp, xpInLevel, xpRequired, pct: Math.min(100, Math.max(0, pct)) };
  }
};
window.Gamification = Gamification;
