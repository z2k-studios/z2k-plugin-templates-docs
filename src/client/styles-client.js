const LS_KEY = 'z2k-style';
const STYLES = ['default', 'github', 'minimal', 'parchment'];

function applyStyle(style) {
  const html = document.documentElement;
  html.classList.remove(...STYLES.map(s => `style-${s}`));
  if (style && style !== 'default') {
    html.classList.add(`style-${style}`);
  }
}

function saveStyle(style) {
  try { localStorage.setItem(LS_KEY, style); } catch {}
}

function getInitialStyle() {
  try { return localStorage.getItem(LS_KEY) || 'default'; } catch { return 'default'; }
}

// Guard everything so SSR doesn’t choke
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Apply immediately when loaded in browser
  applyStyle(getInitialStyle());

  document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('.style-switcher-dropdown a[data-style]');
    links.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const next = link.getAttribute('data-style');
        if (STYLES.includes(next)) {
          applyStyle(next);
          saveStyle(next);
          console.log(`[Z2K] Applied style: ${next}`);
        }
      });
    });

    // For testing from console
    window.__setZ2KStyle = (next) => {
      if (STYLES.includes(next)) {
        applyStyle(next);
        saveStyle(next);
      } else {
        console.warn(`[Z2K] Unknown style: ${next}`);
      }
    };
  });
}