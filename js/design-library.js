// ── Design Library Module ──
window.DesignLibrary = (function () {
  'use strict';

  let catalog = [];
  let activeStyle = 'all';
  let activeBodyPart = 'all';

  async function init() {
    try {
      const res = await fetch('/data/library-catalog.json');
      if (!res.ok) return;
      catalog = await res.json();
      render();
    } catch (e) {
      console.warn('Library catalog not available');
    }
  }

  function render() {
    const grid = document.querySelector('#libraryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = catalog.filter(d => {
      if (activeStyle !== 'all' && d.style !== activeStyle) return false;
      if (activeBodyPart !== 'all' && d.bodyPart !== activeBodyPart) return false;
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<p class="library-empty">No designs found for this filter. Try a different combination.</p>';
      return;
    }

    filtered.forEach(d => {
      const card = document.createElement('div');
      card.className = 'library-card';
      card.innerHTML =
        '<img src="' + d.image + '" alt="' + d.title + '" loading="lazy">' +
        '<div class="library-card-info">' +
          '<span class="library-card-title">' + d.title + '</span>' +
          '<span class="library-card-style">' + d.style + '</span>' +
        '</div>';

      card.addEventListener('click', () => {
        // Load full image and send to preview
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (window.TryInk) {
            window.TryInk.selectDesign(img, d.image);
            if (d.colorMode) window.TryInk.setColorMode(true);
            else window.TryInk.setColorMode(false);
          }
          document.querySelector('#preview').scrollIntoView({ behavior: 'smooth' });
        };
        img.src = d.image;

        // Highlight selected
        grid.querySelectorAll('.library-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });

      grid.appendChild(card);
    });
  }

  // Wire filter buttons
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.lib-style-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lib-style-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeStyle = btn.dataset.style;
        render();
      });
    });

    document.querySelectorAll('.lib-body-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lib-body-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeBodyPart = btn.dataset.body;
        render();
      });
    });

    init();
  });

  return { init, render };
})();
