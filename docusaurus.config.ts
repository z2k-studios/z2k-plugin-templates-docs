import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import rehypeCallouts from 'rehype-callouts';
import navbarItems from './docusaurus.config.embed';

/**
 * Docusaurus Config – Z2K Templates Docs
 *
 * APPROACH: Single docs plugin instance with multiple sidebars (the "niki blog" style).
 *
 * - We define all sidebars in a single `sidebars.ts` file (e.g. "Intro", "How-To Guides",
 *   "Best Practices", "Reference Manual").
 * - The docs plugin loads them all, and then we wire each sidebar into the navbar
 *   using `{ type: 'docSidebar', sidebarId: '...' }`.
 * - Clicking a navbar item switches context into that sidebar, even though technically
 *   everything is under one docs plugin instance (single `/docs` routeBasePath).
 *
 * WHY THIS METHOD:
 * - Keeps things simple: one plugin, one set of docs, one `sidebars.ts`.
 * - Easy cross-linking between docs since all IDs live in the same namespace.
 * - Familiar and well-supported in tutorials and blog posts.
 *
 * ALTERNATIVE: Multiple docs plugin instances (the "multi-instance" approach).
 * - Each docs section would be its own plugin, with its own `id`, `path`, `routeBasePath`,
 *   and sidebar file.
 * - This provides stronger separation (e.g. `/docs`, `/api`, `/community`) and independent
 *   versioning/edit-URL controls, but is more verbose and complex.
 *
 * TL;DR: We only need one docs instance for Z2K Templates right now, so this config uses
 * the simpler multi-sidebar pattern. If we later want separate URL bases (e.g. `/api`),
 * we can migrate to multi-instance.
 */

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)
const config: Config = {
  title: 'Z2K Templates',
  tagline: 'Turbocharge your Obsidian workflow with the Z2K Templates plugin',
  favicon: 'img/favicon.ico',

  future: {
    v4: true, // Compatibility with Docusaurus v4
  },

  url: 'https://z2k-studios.github.io',
  baseUrl: '/z2k-plugin-templates-docs/',

  organizationName: 'z2k-studios',
  projectName: 'z2k-plugin-templates-docs',

  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.ts'),
          rehypePlugins: [rehypeCallouts],
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
          rehypePlugins: [rehypeCallouts],
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      } satisfies Preset.Options,
    ],
  ],

  clientModules: [require.resolve('./src/client/styles-client.js')],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'Z2K Templates',
      logo: {
        alt: 'Z2K System Logo',
        src: 'img/z2k-system.png',
      },
      items: [
        ...navbarItems,
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Intro',
              to: '/docs/readme',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'Stack Overflow', href: 'https://stackoverflow.com/questions/tagged/docusaurus' },
            { label: 'Discord', href: 'https://discordapp.com/invite/docusaurus' },
            { label: 'X', href: 'https://x.com/docusaurus' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'Blog', to: '/blog' },
            { label: 'GitHub', href: 'https://github.com/facebook/docusaurus' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Z2K Studios LLC.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
