---
title: Test Jig - Markdown Links - CANONICAL VERSION
slug: markdown-links
sidebar_position: 20
hide_title: false
z2k-metadata-only: true
---
> This is a hidden test page for validating that various markdown formating is not too far mangled during remarking. ==REMINDER: even if it survives the remark that occurs during my
> own remarking in step 4, it may not survive the remarking that occurs in step 5 in docusaurus
> (i.e. I may have to provide remark options inside the docusaurus's config ts file.==

---

# Link Testing

## 🧪 Obsidian-style `[[WikiLinks]]`

These should resolve based on filename or `slug:`:

- [Z2K Templates and YAML](/z2k-templates-and-yaml)
- [Template Field Types](/template-field-types)
- [Template Field Naming Conventions](/template-field-naming-conventions)
- [Prompting](/prompting)

## 🧪 Obsidian-style `[[WikiLinks/with/paths]]`

- [Code/Obsidian Plugins/z2k-plugin-templates/docs/readme.md](/codeobsidian-pluginsz2k-plugin-templatesdocsreadmemd)
- [/readme.md](/readmemd)
- [readme](/readmemd)
- [reference-manual/Plugin Settings Page.md](/reference-manualplugin-settings-pagemd)

## 🧪 Obsidian-style `[[WikiLinks|Title]]`

- [Partial Templates](/partial-templates)
- [Yaml Stuff](/z2k-system-yaml-files)

## 🧪 Obsidian-style `[[#Header]]`

- [Test Internal Header](#test-internal-header)

## 🧪 Obsidian-style `[[WikiLinks|#Header]]`

- [Formatting Helper Functions](/built-in-template-fields#formatting-helper-functions)
- [Dev Notes](/partial-templates#dev-notes)
- [Developer Notes](/partial-templates#dev-notes)

## 🧪 Obsidian-style `[[WikiLinks|#^Block]]`

- [Default Answer](/prompting#^DefaultAnswer)

## Obsidian-style - multiple

- A real work [example](/template-field-types#template-field-type-built-in-fields)

---

## 🧪 Markdown-style `[Links](file.md)`

These should also redirect to the proper sluggified or slug-defined URLs:

- [Helper Functions](Built-In Helper Functions.md)
- [Template Field Format Defaults](Z2K Template Field Data Default Formatting.md)
- [YAML Config Fields](Z2K Template YAML Configuration Fields.md)
- [Lifecycle](Lifecycle of a Template.md)
- [Not Real](Nonexistent File.md)

## 🧪 Markdown-style `[Links](https://website)`

- [Microsoft](https://microsoft.com)
- [https://github.com/Vinzent03/obsidian-advanced-uri](https://github.com/Vinzent03/obsidian-advanced-uri)

---

## 🚫 Negative Tests

These should remain unlinked or generate fallback behavior (e.g., sluggified guesses):

- [Nonexistent Concept](/nonexistent-concept)
- [Bad File](NotAFile.md)

---

# Formatting Testing

## 1. Standard link should stay as-is

[https://github.com/Vinzent03/obsidian-advanced-uri](https://github.com/Vinzent03/obsidian-advanced-uri)

## 2. Horizontal rule

---

---

---

## 3. List items (dash vs asterisk vs plus)

- dash item

* star item

- plus item

## 4. Highlight syntax (Obsidian style)

==still to be done and documented==

## 5. Indentation (3 vs 4 spaces)

- Parent
  - Child with 3 spaces
  - Child with 4 spaces

## 6. Underscore in heading

### z2k_card_build_state

## 7. Mixed emphasis and strong

*this is italic* and *also italic*
**this is bold** and **also bold**

## 8. Code blocks

This is a `constant` string.

```
console.log("fenced code");
    console.log("indented code");
```

---

## ✅ Result Verification

Use this file to confirm:

- Your `remark-fix-links` plugin is resolving slugs properly.
- Broken or unknown links still degrade gracefully.
- Auto-slug generation works consistently.

## Test Internal Header

This internal header is jumped to up above

Note: ==Remark may add an extra carriage return after every header when writing.==
