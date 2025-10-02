// lib/generate-navbar.ts
import fs from 'fs-extra';
import path from 'path';
import type { Index } from './types.ts';
import * as utils from './utils.ts';

/**
 * Minimal Navbar item shape used by Docusaurus themeConfig.navbar.items
 */
export type NavbarItem = {
  type?: 'docSidebar' | string;
  sidebarId?: string;
  position?: 'left' | 'right';
  label?: string;
  to?: string;
  href?: string;
};

// ====================================================================================================
// Step 6: Write Docusaurus Config Embed
// ====================================================================================================
/**
 * Outputs a TypeScript module containing the navbar items configuration for docusaurus.
 *
 * Behavior summary:
 * - Parses ./sidebars.ts (best-effort) and builds lookup maps.
 * - When a top-level folder (inferred) maps to a sidebars.ts key, it uses the exact case-preserving
 *   key for both sidebarId and label.
 * - If multiple folders map to the same sidebar key, only one navbar item is emitted (no duplicates).
 * - If no match is found the generator emits a stable slug sidebarId and a humanized label.
 * - Emits `navbarItems.ts` (or file at given outPath) and `navbarItems.debug.json`.
 *
 * @param index - The file/folder index produced by Step 2.
 * @param outPath - destination file or directory
 * @param opts - options (explicit mapping or inferFromRoot)
 */
export function writeNavbarItems(
  index: Index,
  outPath: string,
  opts?: {
    explicit?: Array<{ sidebarId: string; label?: string; position?: 'left' | 'right' }>;
    inferFromRoot?: boolean;
  }
) {
  // --- Resolve output path (file or directory) ---
  const resolvedBase =
    outPath && typeof outPath === 'string' && outPath.length > 0
      ? path.resolve(outPath)
      : path.resolve((utils as any).PATH_DOCUSAURUS ?? process.cwd(), 'generated');

  const isFile = path.extname(resolvedBase) !== '';
  const generatedFilePath = isFile ? resolvedBase : path.join(resolvedBase, 'navbarItems.ts');
  fs.ensureDirSync(path.dirname(generatedFilePath));

  // --- Defaults (fallback nav) ---
  const defaultTopLevel: Array<{ sidebarId: string; label: string; position: 'left' | 'right' }> = [
    { sidebarId: 'Intro', label: 'Intro', position: 'left' },
  ];

  let items: NavbarItem[] = [];
  let provenance: 'explicit' | 'inferred' | 'default' = 'default';
  const inferredFrom: string[] = [];

  // --- Helper: Extract sidebar keys from sidebars.ts (best-effort) ---
  let sidebarKeys: string[] = [];
  try {
    const sidebarsPath = path.resolve((utils as any).PATH_DOCUSAURUS ?? process.cwd(), 'sidebars.ts');
    if (fs.existsSync(sidebarsPath)) {
      const sidebarsContent = fs.readFileSync(sidebarsPath, 'utf8');
      // capture the object literal inside `const sidebars = { ... }` if present
      const bodyMatch = sidebarsContent.match(/const\s+sidebars\s*=\s*{([\s\S]*?)\n};/m);
      const body = bodyMatch ? bodyMatch[1] : sidebarsContent;
      // capture top-level keys (allow quoted or unquoted keys)
      const keyRegex = /(^|\n)\s*['"]?([A-Za-z0-9 _\-\:]+)['"]?\s*:/g;
      let m;
      while ((m = keyRegex.exec(body)) !== null) {
        const raw = String(m[2] || '').trim();
        if (raw) sidebarKeys.push(raw);
      }
      // preserve order and uniqueness
      sidebarKeys = Array.from(new Set(sidebarKeys));
    }
  } catch (err) {
    utils.verboseLog(`[writeNavbarItems] sidebars.ts parse error: ${String(err)}`);
  }

  // Build robust lookup maps:
  // - exactKeySet: set of keys as-is (case-preserving)
  // - lowerToKey: lowercase(key) -> key
  // - slugToKey: sluggified(key) -> key
  // - normToKey: normalized (slug w/o dashes) -> key  (helps when candidates yield 'howtoguides' etc)
  const exactKeySet = new Set(sidebarKeys);
  const lowerToKey = new Map<string, string>();
  const slugToKey = new Map<string, string>();
  const normToKey = new Map<string, string>();

  function normalizeForLookup(s: string) {
    return String(s || '').trim().toLowerCase();
  }
  function normalizeSlugNoDash(s: string) {
    return String(s || '').replace(/[-_]+/g, '').toLowerCase();
  }

  for (const k of sidebarKeys) {
    lowerToKey.set(normalizeForLookup(k), k);
    const slug = utils.sluggify(String(k) ?? '');
    if (slug) {
      slugToKey.set(slug.toLowerCase(), k);
      normToKey.set(normalizeSlugNoDash(slug), k);
    }
    // also map slugless normalization of the raw key (remove spaces)
    normToKey.set(String(k).replace(/\s+/g, '').toLowerCase(), k);
  }

  // uniqueness bookkeeping for generated IDs (ensures no duplicate sidebarId entries in final navbar)
  const usedIds = new Set<string>();
  function makeUnique(base: string) {
    let id = String(base);
    if (!id) id = 'section';
    let i = 1;
    while (usedIds.has(id)) {
      i += 1;
      id = `${String(base)}-${i}`;
    }
    usedIds.add(id);
    return id;
  }

  // small helpers
  function sluggifyFn(s: string) {
    if (utils && typeof (utils as any).sluggify === 'function') {
      return (utils as any).sluggify(String(s || ''));
    }
    return String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
  }

  function humanizeFn(s: string) {
    if (!s) return '';
    return String(s)
      .replace(/[-_]+/g, ' ')
      .trim()
      .split(/\s+/)
      .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ');
  }

  function lastSegmentOfNormalizedDestDir(f: any) {
    const nd = String(f.normalizedDestDir ?? '').replace(/^\/|\/$/g, '');
    const parts = nd.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }

  /**
   * Try multiple strategies to map a candidate to an exact sidebars.ts key.
   * Returns the matched key (case-preserving) or null.
   */
  function findMatchingSidebarKey(candidate: string | null | undefined): string | null {
    if (!candidate) return null;
    const raw = String(candidate).trim();
    if (!raw) return null;

    // 1) exact case-preserving key match
    if (exactKeySet.has(raw)) return raw;

    // 2) case-insensitive match
    const lower = normalizeForLookup(raw);
    if (lowerToKey.has(lower)) return lowerToKey.get(lower)!;

    // 3) direct slug lookup (candidate might already be slug-like)
    const candidateSlug = sluggifyFn(raw).toLowerCase();
    if (slugToKey.has(candidateSlug)) return slugToKey.get(candidateSlug)!;

    // 4) candidate cleaned (remove dashes) -> normToKey
    const candidateNorm = normalizeSlugNoDash(candidateSlug);
    if (normToKey.has(candidateNorm)) return normToKey.get(candidateNorm)!;

    // 5) as a last try, compare candidate stripped spaces/lower
    const stripped = raw.replace(/\s+/g, '').toLowerCase();
    if (normToKey.has(stripped)) return normToKey.get(stripped)!;

    return null;
  }

  /**
   * Choose a sidebarId (id) and display label (label) for a folder entry.
   *
   * Strategy:
   * - Build candidate tokens from the folder metadata (finalDestFolder, normalizedDestDir last segment,
   *   destTitle, sourceName).
   * - Try findMatchingSidebarKey() against each candidate in prioritized order.
   * - If a match is found use the exact matchedKey for BOTH sidebarId and label (case-preserving).
   *   *Important:* do NOT append numeric suffixes to matched sidebar keys — instead skip duplicates
   *   so we don't produce duplicate navbar items for the same sidebar.
   * - If no match is found, produce a stable slug id and humanized label. Ensure uniqueness via makeUnique.
   */
  function chooseSidebarPair(f: any): { sidebarKey?: string; id: string; label: string; skip?: boolean } {
    const candidates: string[] = [];

    if (f.finalDestFolder) candidates.push(String(f.finalDestFolder));
    const last = lastSegmentOfNormalizedDestDir(f);
    if (last) candidates.push(last);
    if (f.destTitle) candidates.push(String(f.destTitle));
    if (f.sourceName) candidates.push(String(f.sourceName));
    if (f.destDir) candidates.push(String(f.destDir));

    // Deduplicate
    const uniqCandidates = Array.from(new Set(candidates.filter(Boolean).map(c => String(c).trim())));

    // Try to find a matching sidebar key
    for (const c of uniqCandidates) {
      const matched = findMatchingSidebarKey(c);
      if (matched) {
        // If this sidebar key already used in navbar, skip adding a duplicate entry
        if (usedIds.has(matched)) {
          return { sidebarKey: matched, id: matched, label: matched, skip: true };
        }
        // otherwise, reserve and return it (use exact key as id + label)
        usedIds.add(matched);
        return { sidebarKey: matched, id: matched, label: matched, skip: false };
      }
    }

    // No sidebars.ts match — fallback to a stable slug id + humanized label
    // pick the best fallback token (prefer destTitle if it isn't generic "Overview")
    let fallbackToken = uniqCandidates.find(c => c && c !== 'Overview') ?? uniqCandidates[0] ?? f.finalDestFolder ?? f.sourceName ?? f.destDir ?? 'section';
    let slug = sluggifyFn(String(fallbackToken));
    if (!slug) slug = 'section';
    const uniqueId = makeUnique(slug);
    const label = f.destTitle && f.destTitle !== 'Overview' ? String(f.destTitle) : humanizeFn(String(fallbackToken));
    return { id: uniqueId, label, skip: false };
  }

  // --- Build items: explicit mapping, inference, or default ---
  if (opts?.explicit && opts.explicit.length > 0) {
    provenance = 'explicit';
    for (const e of opts.explicit) {
      const id = String(e.sidebarId);
      if (!usedIds.has(id)) {
        usedIds.add(id);
        items.push({
          type: 'docSidebar',
          sidebarId: id,
          label: e.label ?? id,
          position: (e.position ?? 'left') as 'left' | 'right',
        });
      }
    }
  } else if (opts?.inferFromRoot) {
    const topLevelFolders = (index.folders || [])
      .filter(function (f) {
        const nd = String(f.normalizedDestDir ?? '').replace(/^\/|\/$/g, '');
        if (!nd) return false; // skip root
        const parts = nd.split('/').filter(Boolean);
        return parts.length === 1;
      })
      .sort(function (a, b) {
        return (a.sidebarPosition ?? 0) - (b.sidebarPosition ?? 0);
      });

    if (topLevelFolders.length > 0) {
      provenance = 'inferred';
      for (const f of topLevelFolders) {
        const pair = chooseSidebarPair(f);
        // record mapping provenance
        inferredFrom.push(JSON.stringify({ folder: f.finalDestFolder ?? f.destDir ?? f.destSlug, mappedTo: pair.id }));
        if (pair.skip) {
          // already mapped previously — don't emit duplicate navbar item
          continue;
        }
        // add docSidebar item (pair.id is either exact sidebars.ts key or unique slug)
        items.push({
          type: 'docSidebar',
          sidebarId: pair.id,
          label: pair.label,
          position: 'left' as const,
        } as NavbarItem);
      }
    } else {
      // fallback heuristic using destDir (older behavior)
      const fallback = (index.folders || [])
        .filter(function (f) {
          const parts = (f.destDir || '').split('/').filter(Boolean);
          return parts.length === 1;
        })
        .sort(function (a, b) {
          return (a.sidebarPosition ?? 0) - (b.sidebarPosition ?? 0);
        });

      if (fallback.length > 0) {
        provenance = 'inferred';
        for (const f of fallback) {
          const pair = chooseSidebarPair(f);
          inferredFrom.push(JSON.stringify({ folder: f.finalDestFolder ?? f.destDir ?? f.destSlug, mappedTo: pair.id }));
          if (pair.skip) continue;
          items.push({
            type: 'docSidebar',
            sidebarId: pair.id,
            label: pair.label,
            position: 'left' as const,
          } as NavbarItem);
        }
      }
    }
  }

  // If inference produced no items, emit defaults (but ensure we don't duplicate keys)
  if (items.length === 0) {
    provenance = provenance === 'explicit' ? provenance : 'default';
    for (const d of defaultTopLevel) {
      if (!usedIds.has(d.sidebarId)) {
        usedIds.add(d.sidebarId);
        items.push({
          type: 'docSidebar',
          sidebarId: d.sidebarId,
          label: d.label,
          position: d.position,
        });
      }
    }
  } else {
    // Ensure common canonical top-level "Intro" exists at front if sidebars.ts contains it and it's not yet present.
    if (sidebarKeys.includes('Intro') && !items.some(it => it.type === 'docSidebar' && String(it.sidebarId) === 'Intro')) {
      // Insert at start
      if (!usedIds.has('Intro')) {
        usedIds.add('Intro');
        items.unshift({ type: 'docSidebar', sidebarId: 'Intro', label: 'Intro', position: 'left' });
      }
    }
    // As a safety, if "How To Guides" exists in sidebars.ts but not in items, prefer to insert it after Intro
    if (sidebarKeys.includes('How To Guides') && !items.some(it => it.type === 'docSidebar' && String(it.sidebarId) === 'How To Guides')) {
      if (!usedIds.has('How To Guides')) {
        usedIds.add('How To Guides');
        // find insertion index after Intro (if present)
        const idx = items.findIndex(it => it.sidebarId === 'Intro');
        const insertAt = idx >= 0 ? idx + 1 : 0;
        items.splice(insertAt, 0, { type: 'docSidebar', sidebarId: 'How To Guides', label: 'How To Guides', position: 'left' });
      }
    }
  }

  // Always append blog + github items last if not present
  if (!items.some(it => it.to === '/blog')) items.push({ to: '/blog', label: 'Blog', position: 'left' });
  if (!items.some(it => it.href && it.href.includes('github.com'))) {
    items.push({ href: 'https://github.com/z2k-studios/z2k-plugin-templates-docs', label: 'GitHub', position: 'right' });
  }

  // --- Build provenance metadata & module contents ---
  const meta = {
    source: provenance,
    timestamp: new Date().toISOString(),
    inferredFrom,
    indexSummary: { folders: index.folders?.length ?? 0, files: index.files?.length ?? 0 },
    itemsCount: items.length,
  };

  const moduleContents = 
`// AUTO GENERATED IN STEP 6 - DO NOT EDIT
// Created: ${new Date().toISOString()}

export const navbarMeta = ${JSON.stringify(meta, null, 2)};

const navbarItems = ${JSON.stringify(items, null, 2)} as any;

export default navbarItems;
`;

  // --- Write outputs ---
  fs.writeFileSync(generatedFilePath, moduleContents, 'utf8');

  utils.statusLog(`🧭 Navbar items written to ${generatedFilePath} (provenance=${provenance})`);

  // --- Best-effort validation: warn about docSidebar sidebarIds not present in sidebars.ts (only when sidebars parsed) ---
  try {
    if (sidebarKeys.length > 0) {
      const missing = items
        .filter(it => it.type === 'docSidebar' && it.sidebarId && !sidebarKeys.some(k => k === String(it.sidebarId)))
        .map(it => String(it.sidebarId));
      if (missing.length) {
        utils.warningLog(
          `[writeNavbarItems] NOTICE: generated sidebarId(s) not literal keys in sidebars.ts (these are fallbacks): ${[...new Set(missing)].join(
            ', '
          )}`
        );
      } else {
        utils.warningLog('[writeNavbarItems] All generated sidebarIds are exact keys present in sidebars.ts');
      }
    } else {
      utils.warningLog('[writeNavbarItems] sidebars.ts not found or could not be parsed; skipping validation');
    }
  } catch (err) {
    utils.warningLog(`[writeNavbarItems] validation skipped (error): ${String(err)}`);
  }

  return generatedFilePath;
}
