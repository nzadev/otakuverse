const CommentsSystem = {
  db: null,
  init() {
    this.db = window.db; // Assuming db is set from app.js
    
    this.btnToggle = document.getElementById('btnCommentsToggle');
    this.sidebar = document.getElementById('commentsSidebar');
    this.btnClose = document.getElementById('btnCloseComments');
    this.list = document.getElementById('commentsList');
    this.input = document.getElementById('commentInput');
    this.btnSubmit = document.getElementById('btnSubmitComment');
    
    if (this.btnToggle) {
      this.btnToggle.addEventListener('click', () => {
        this.sidebar.classList.toggle('hidden');
        if (!this.sidebar.classList.contains('hidden')) {
          this.loadComments();
        }
      });
    }
    
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => {
        this.sidebar.classList.add('hidden');
      });
    }
    
    if (this.btnSubmit) {
      this.btnSubmit.addEventListener('click', () => this.postComment());
    }
  },
  
  getCollectionPath() {
    if (!window.state || !window.state.currentAnime || window.state.currentEpIndex === undefined) return null;
    return `anime_comments/${window.state.currentAnime.id}_${window.state.currentEpIndex}/messages`;
  },
  
  unsubscribe: null,
  
  loadComments() {
    if (!this.db) this.db = window.db;
    if (!this.db) return;
    
    const path = this.getCollectionPath();
    if (!path) return;
    
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    this.list.innerHTML = '<div style="text-align:center; padding: 20px; color:#888;">Memuat komentar...</div>';
    
    this.unsubscribe = this.db.collection(path)
      .orderBy('timestamp', 'asc')
      .onSnapshot(snapshot => {
        this.list.innerHTML = '';
        if (snapshot.empty) {
          this.list.innerHTML = '<div style="text-align:center; padding: 20px; color:#888;">Belum ada komentar. Jadilah yang pertama!</div>';
          return;
        }
        
        snapshot.forEach(doc => {
          const data = doc.data();
          const div = document.createElement('div');
          div.className = 'comment-item';
          div.innerHTML = `
            <div class="comment-author">${data.authorName}</div>
            <div class="comment-text">${data.text}</div>
          `;
          this.list.appendChild(div);
        });
        
        // Auto scroll to bottom
        this.list.scrollTop = this.list.scrollHeight;
      }, err => {
        console.error("Gagal memuat komentar:", err);
        this.list.innerHTML = '<div style="text-align:center; padding: 20px; color:#ff3366;">Gagal memuat komentar.</div>';
      });
  },
  
  postComment() {
    const text = this.input.value.trim();
    if (!text) return;
    
    if (!window.currentUser) {
      if (typeof showToast === 'function') showToast("Kamu harus login untuk berkomentar!");
      return;
    }
    
    const path = this.getCollectionPath();
    if (!path || !this.db) return;
    
    this.btnSubmit.disabled = true;
    this.db.collection(path).add({
      authorId: window.currentUser.uid,
      authorName: window.currentUser.displayName || 'User',
      text: text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      this.input.value = '';
      this.btnSubmit.disabled = false;
      if (typeof showToast === 'function') showToast("Komentar terkirim!");
    }).catch(err => {
      console.error(err);
      this.btnSubmit.disabled = false;
      if (typeof showToast === 'function') showToast("Gagal mengirim komentar.");
    });
  }
};
window.CommentsSystem = CommentsSystem;
