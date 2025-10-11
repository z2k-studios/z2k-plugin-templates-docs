/**
 * Z2K: Prism injector to highlight Handlebars fields {{…}} inside:
 * - Markdown (including headers, bold, italic, etc.)
 * - YAML fenced code blocks
 *
 * Design goals:
 * - SSR-safe: works during Docusaurus SSG and in the browser
 * - No top-level Prism redeclaration (avoids “Cannot redeclare 'Prism'”)
 * - Loads Handlebars deps in correct order (markup → markup-templating → handlebars)
 * - Idempotent: guarded to handle HMR / double-execution
 * - Robust: deep-seeds nested grammar `inside`/`rest` while avoiding cycles
 *
 * Usage:
 * - Place this file at: src/prism-markdown-handlebars.ts
 * - Register in docusaurus.config.(ts|js):
 *     clientModules: [require.resolve('./src/prism-markdown-handlebars.ts')]
 * - (Optional) themeConfig.prism.additionalLanguages: ['handlebars']
 */

(() => {
  // Get the Prism instance vendored by prism-react-renderer
  const PrismCore = (require('prism-react-renderer') as any).Prism;
  if (!PrismCore) return;

  // Make the instance visible to prismjs component loaders (SSR + client)
  const g: any =
    typeof globalThis !== 'undefined' ? globalThis :
    typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {};
  if (g.Prism && g.Prism.__z2kMdHbPatched) return; // already patched
  g.Prism = g.Prism || PrismCore;

  // --- Load grammars in dependency order ---
  // Handlebars depends on markup-templating, which depends on markup.
  require('prismjs/components/prism-markup');
  require('prismjs/components/prism-markup-templating');
  require('prismjs/components/prism-handlebars');

  // Host grammars we want to augment
  require('prismjs/components/prism-markdown');
  require('prismjs/components/prism-yaml');

  // The token that recognizes {{…}} and delegates to the Handlebars grammar inside
  const hbToken = {
    pattern: /{{[\s\S]*?}}/g,
    greedy: true,                 // so the whole {{…}} region is one outer match
    alias: 'hb-field',            // gives us a stable CSS hook
    inside: g.Prism.languages.handlebars,
  };

  /**
   * Insert the handlebars token into a language before the earliest available anchor.
   * Falls back to attaching at the language root if no anchors exist.
   */
  function inject(langId: string, before: string[]): void {
    const lang = g.Prism.languages[langId];
    if (!lang) return;
    for (const key of before) {
      if ((lang as any)[key] != null) {
        g.Prism.languages.insertBefore(langId, key, { handlebars: hbToken });
        return;
      }
    }
    if (!(lang as any).handlebars) (lang as any).handlebars = hbToken;
  }

  /** Ensure a definition has an `inside` object and contains our `handlebars` token. */
  function ensureHbInside(def: any) {
    if (!def || typeof def !== 'object') return;
    if (!def.inside || typeof def.inside !== 'object') def.inside = {};
    if (!def.inside.handlebars) def.inside.handlebars = hbToken;
  }

  /**
   * Deeply seed a grammar with our token, traversing `inside` and `rest`,
   * while avoiding infinite recursion on cyclic/shared objects (Prism grammars often share refs).
   */
  function deepInjectGrammar(grammar: any, seen = new WeakSet<any>()) {
    if (!grammar || typeof grammar !== 'object') return;
    if (seen.has(grammar)) return;
    seen.add(grammar);

    for (const key of Object.keys(grammar)) {
      const def = (grammar as any)[key];
      const defs = Array.isArray(def) ? def : def ? [def] : [];
      for (const d of defs) {
        // Skip our own token and non-objects
        if (!d || typeof d !== 'object' || d === hbToken) continue;

        // Ensure handlebars is present early in each nested 'inside'
        ensureHbInside(d);

        // Recurse into nested structures
        if (d.inside) deepInjectGrammar(d.inside, seen);
        if (d.rest)   deepInjectGrammar(d.rest,   seen);
      }
    }
  }

  // --- Markdown: make {{…}} trump inner tokens (headers, bold, italic, etc.) ---
  // Insert early, then deep-seed so nested tokens like 'title', 'bold', 'italic', 'content' get it too.
  inject('markdown', ['code', 'url', 'title', 'bold', 'italic', 'important', 'punctuation']);
  const md = g.Prism.languages.markdown as any;
  deepInjectGrammar(md);

  // Bold/italic frequently wrap inner text under a 'content' sub-token; ensure it’s primed.
  ['bold', 'italic'].forEach((k) => {
    const def = md?.[k];
    const defs = Array.isArray(def) ? def : def ? [def] : [];
    for (const d of defs) {
      ensureHbInside(d);
      if (d.inside) {
        d.inside.content = d.inside.content || {};
        ensureHbInside(d.inside.content);
      }
    }
  });

  // --- YAML (inside fenced code blocks): win before punctuation and seed nested shapes ---
  // This ensures {{…}} becomes an hb-field (not swallowed as plain punctuation),
  // and any nested YAML token structures also see handlebars.
  inject('yaml', ['punctuation', 'string', 'scalar', 'key']);
  deepInjectGrammar(g.Prism.languages.yaml);

  // Mark as patched so we don’t run again
  g.Prism.__z2kMdHbPatched = true;
})();
