/**
 * Z2K: Prism injector to highlight Handlebars fields {{…}} inside:
 * - Markdown (including headers, bold, italic, etc.)
 * - YAML fenced code blocks (including YAML rendered inside Markdown front-matter)
 *
 * Design goals:
 * - SSR-safe: works during Docusaurus SSG and in the browser
 * - No top-level Prism redeclaration (avoids “Cannot redeclare 'Prism'”)
 * - Loads Handlebars deps in correct order (markup → markup-templating → handlebars)
 * - Idempotent: guarded to handle HMR / double-execution
 * - Robust: deep-seeds nested grammar `inside`/`rest` while avoiding cycles
 *
 * Usage:
 *   1) Place this file at: src/prism-markdown-handlebars.ts
 *   2) Register in docusaurus.config.(ts|js):
 *        clientModules: [require.resolve('./src/prism-markdown-handlebars.ts')]
 *   3) (Optional) themeConfig.prism.additionalLanguages: ['handlebars']
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

  const Prism = g.Prism;

  // ---- Handlebars token (outer wrapper) ----
  const hbToken = {
    pattern: /{{[\s\S]*?}}/g,
    greedy: true,
    // Use 'handlebars' type with alias so both theme + custom CSS can target it
    alias: 'hb-field',
    inside: Prism.languages.handlebars,
  };

  // ---------- helpers ----------
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
    if (!grammar || typeof grammar !== 'object' || seen.has(grammar)) return;
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

  // ---------- 1) Seed YAML first (covers embedded/front-matter YAML) ----------
  const yaml = Prism.languages.yaml;
  if (yaml) {
    // Make {{…}} win before punctuation/strings/keys
    Prism.languages.insertBefore('yaml', 'punctuation', { handlebars: hbToken });
    // Deeply seed nested shapes
    deepInjectGrammar(yaml);
  }

  // ---------- 2) Inject into Markdown, before its 'code' rule ----------
  const md = Prism.languages.markdown as any;
  if (md) {
    Prism.languages.insertBefore('markdown', 'code', { handlebars: hbToken });
    deepInjectGrammar(md);

    // Common nesting: bold/italic content buckets
    ['bold', 'italic'].forEach((k) => {
      const def = md[k];
      const defs = Array.isArray(def) ? def : def ? [def] : [];
      for (const d of defs) {
        ensureHbInside(d);
        if (d.inside) {
          d.inside.content = d.inside.content || {};
          ensureHbInside(d.inside.content);
        }
      }
    });
  }

  // ---------- 3) Final safety net: merge brace runs into one token ----------
  if (!Prism.__z2kHbHookAdded) {
    Prism.hooks.add('after-tokenize', (env: any) => {
      if (!env || !Array.isArray(env.tokens)) return;

      const Token = Prism.Token;

      function isPunct(token: any, ch: string) {
        return token && typeof token === 'object' && token.type === 'punctuation' && token.content === ch;
      }

      function wrap(tokens: any[]) {
        for (let i = 0; i < tokens.length; i++) {
          const t = tokens[i];

          // Recurse into children/nested languages first (front-matter arrays, etc.)
          if (Array.isArray(t)) { wrap(t); continue; }
          if (t && typeof t === 'object' && Array.isArray(t.content)) { wrap(t.content); }

          // Opening: either '{{' as one token or two '{'
          const isOpenSingle = t && typeof t === 'object' && t.type === 'punctuation' && t.content === '{{';
          const isOpenPair   = isPunct(t, '{') && isPunct(tokens[i + 1], '{');
          if (!isOpenSingle && !isOpenPair) continue;

          const openLen = isOpenSingle ? 1 : 2;

          // Find closing: '}}' as one token or two '}'
          let j = i + openLen;
          let end = -1;
          let closeIsPair = false;
          for (; j < tokens.length; j++) {
            const tj = tokens[j];
            const isCloseSingle = tj && typeof tj === 'object' && tj.type === 'punctuation' && tj.content === '}}';
            const isClosePair   = isPunct(tj, '}') && isPunct(tokens[j + 1], '}');
            if (isCloseSingle) { end = j; break; }
            if (isClosePair)   { end = j + 1; closeIsPair = true; break; }

            // Keep descending in case nested arrays appear mid-sequence
            if (Array.isArray(tj)) wrap(tj);
            else if (tj && typeof tj === 'object' && Array.isArray(tj.content)) wrap(tj.content);
          }
          if (end === -1) continue;

          const openTokens  = tokens.slice(i, i + openLen);
          const innerStart  = i + openLen;
          const innerEnd    = closeIsPair ? (end - 1) : end;
          const inner       = tokens.slice(innerStart, innerEnd);
          const closeTokens = tokens.slice(innerEnd, end + 1);

          // Real Prism.Token; type 'handlebars' with alias 'hb-field' (plus 'handlebars' for theme)
          const hbWrapper = new Token(
            'handlebars',
            [...openTokens, ...inner, ...closeTokens],
            ['hb-field', 'handlebars']
          );

          tokens.splice(i, end - i + 1, hbWrapper);
          i++; // advance past the wrapper
        }
      }

      wrap(env.tokens);
    });

    Prism.__z2kHbHookAdded = true;
  }

  Prism.__z2kMdHbPatched = true;
})();