// src/prism-markdown-handlebars.ts
// Idempotent, no top-level Prism binding.
(() => {
  const PrismCore = (require('prism-react-renderer') as any).Prism;
  if (!PrismCore) return;

  // Make the instance visible to prismjs component loaders (SSR + client)
  const g: any =
    typeof globalThis !== 'undefined' ? globalThis :
    typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {};
  if (g.Prism && g.Prism.__z2kMdHbPatched) return; // idempotent guard
  g.Prism = g.Prism || PrismCore;

  // Load deps in order so handlebars can call buildPlaceholders safely
  require('prismjs/components/prism-markup');
  require('prismjs/components/prism-markup-templating');
  require('prismjs/components/prism-handlebars');
  require('prismjs/components/prism-markdown');

  g.Prism.languages.insertBefore('markdown', 'url', {
    handlebars: { pattern: /{{[\s\S]*?}}/g, inside: g.Prism.languages.handlebars },
  });

  g.Prism.__z2kMdHbPatched = true;
})();