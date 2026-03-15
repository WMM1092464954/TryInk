// ── User Auth & Data Persistence ──
// Uses Firebase Auth (Google sign-in) + Firestore for credits & design history

window.TryInkAuth = (function () {
  'use strict';

  let currentUser = null;
  let fbReady = null; // resolved when Firebase methods are loaded

  const $ = (s) => document.querySelector(s);

  // Initialize — load Firebase methods and set up auth listener
  fbReady = (async function init() {
    // Wait for Firebase globals (set by module script in HTML)
    await new Promise((resolve) => {
      const check = () => {
        if (window.firebaseAuth && window.firebaseDb) resolve();
        else setTimeout(check, 100);
      };
      check();
    });

    // Dynamic imports for Firebase auth/firestore methods
    const authMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const fsMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const methods = {
      signInWithPopup: authMod.signInWithPopup,
      GoogleAuthProvider: authMod.GoogleAuthProvider,
      signOut: authMod.signOut,
      doc: fsMod.doc,
      getDoc: fsMod.getDoc,
      setDoc: fsMod.setDoc,
      updateDoc: fsMod.updateDoc,
      arrayUnion: fsMod.arrayUnion,
      Timestamp: fsMod.Timestamp
    };

    authMod.onAuthStateChanged(window.firebaseAuth, async (user) => {
      currentUser = user;
      updateUI(user);
      if (user) await syncUserData(user, methods);
    });

    return methods;
  })();

  // Update nav UI based on auth state
  function updateUI(user) {
    const authBtn = $('#authBtn');
    const userMenu = $('#userMenu');
    if (!authBtn) return;

    const myDesignsSection = $('#myDesigns');

    if (user) {
      authBtn.style.display = 'none';
      if (userMenu) userMenu.style.display = 'flex';
      const userName = $('#userName');
      const userAvatar = $('#userAvatar');
      if (userName) userName.textContent = user.displayName || 'User';
      if (userAvatar) {
        userAvatar.src = user.photoURL || '';
        userAvatar.style.display = user.photoURL ? '' : 'none';
      }
      if (myDesignsSection) myDesignsSection.style.display = '';
    } else {
      authBtn.style.display = '';
      if (userMenu) userMenu.style.display = 'none';
      if (myDesignsSection) myDesignsSection.style.display = 'none';
    }
  }

  // Sync user data with Firestore
  async function syncUserData(user, m) {
    try {
      const userRef = m.doc(window.firebaseDb, 'users', user.uid);
      const snap = await m.getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.credits === 'number' && window.TryInk) {
          window.TryInk.setCredits(data.credits);
        }
        renderMyDesigns(data.designs || []);
      } else {
        await m.setDoc(userRef, {
          email: user.email,
          name: user.displayName || '',
          credits: 50,
          designs: [],
          createdAt: m.Timestamp.now()
        });
      }
    } catch (err) {
      console.warn('Firestore sync error:', err.message);
    }
  }

  // Render user's design history
  function renderMyDesigns(designs) {
    const grid = $('#myDesignsGrid');
    if (!grid) return;
    if (!designs.length) {
      grid.innerHTML = '<p class="library-empty">No designs yet. Generate your first tattoo above!</p>';
      return;
    }
    grid.innerHTML = '';
    // Show newest first
    designs.slice().reverse().forEach(d => {
      const card = document.createElement('div');
      card.className = 'my-design-card';
      card.innerHTML =
        '<div style="aspect-ratio:1;background:var(--bg3);display:flex;align-items:center;justify-content:center;color:var(--tx2);font-size:.9rem;padding:12px;text-align:center">' +
          (d.prompt || 'Untitled') +
        '</div>' +
        '<div class="my-design-info">' +
          '<span class="prompt">' + (d.prompt || 'Untitled') + '</span>' +
          '<span class="meta">' + (d.style || '') + '</span>' +
        '</div>';
      grid.appendChild(card);
    });
  }

  // Sign in with Google
  async function signIn() {
    try {
      const m = await fbReady;
      await m.signInWithPopup(window.firebaseAuth, new m.GoogleAuthProvider());
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') return;
      console.error('Sign-in error:', err);
      alert('Sign-in failed: ' + (err.message || 'Please try again.'));
    }
  }

  // Sign out
  async function logOut() {
    try {
      const m = await fbReady;
      await m.signOut(window.firebaseAuth);
      currentUser = null;
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  }

  // Save credits to Firestore
  async function saveCredits(credits) {
    if (!currentUser) return;
    try {
      const m = await fbReady;
      await m.updateDoc(m.doc(window.firebaseDb, 'users', currentUser.uid), { credits });
    } catch (err) {
      console.warn('Failed to save credits:', err.message);
    }
  }

  // Save a design to history
  async function saveDesign(designData) {
    if (!currentUser) return;
    try {
      const m = await fbReady;
      await m.updateDoc(m.doc(window.firebaseDb, 'users', currentUser.uid), {
        designs: m.arrayUnion({
          prompt: designData.prompt || '',
          style: designData.style || '',
          thumbnail: designData.thumbnail || '',
          createdAt: m.Timestamp.now()
        })
      });
    } catch (err) {
      console.warn('Failed to save design:', err.message);
    }
  }

  function getUser() { return currentUser; }

  return { signIn, logOut, saveCredits, saveDesign, getUser };
})();
