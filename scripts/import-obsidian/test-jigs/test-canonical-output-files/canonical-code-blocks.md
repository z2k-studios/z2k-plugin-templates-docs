---
title: Test Jig - Code Blocks & Raw HTML - CANONICAL
slug: code-blocks
sidebar_position: 20
hide_title: false
z2k-metadata-only: true
---
# Test Jig — Code Blocks & Raw HTML

## Purpose

This file contains a broad set of examples (fenced code blocks, inline code, indented code, HTML blocks, backtick-escaping, and nested constructs) to verify that the import/remark pipeline:

- Does **not** rewrite links or wikilinks found *inside* code fences.
- Preserves HTML blocks verbatim (no conversion / parsing as markdown).
- Preserves inline code spans exactly.
- Handles nested/escaped fences safely.

Test checklist (quick)

- Anything between ` ` (or other fence styles) must be left unchanged.
- Inline `code` must be preserved.
- HTML blocks (e.g. `<div>`, `<script>`) should remain raw and not be interpreted as markdown.
- Wikilinks such as `[[Some Note]]` inside code blocks should not become links.
- Markdown links such as `[Label](../some/path.md)` inside code blocks should not be resolved or altered.

---

# Testing Scenarios

## 1) Inline code & backtick variations

- Inline single-tick code: `const x = 1` should remain `const x = 1`.
- Multiple inline backticks when content contains a single backtick: `Use `backtick` inside`
- Inline code that looks like a link: `` `http://example.com/foo` ``
- Edge case: inline backtick with backslash escapes: `this is \`escaped\` backtick\` (should stay literal).
- Back tick formatting:
  - Bold: `this is *bold* that should not be made bold`
  - Outer Bold: *`this is a bold comment`*
  - Making fields look like fields: `{{field}}`

---

## 2) Simple fenced code blocks (common cases)

```md
* List Item that shouldn't switch to -
* [[callouts]] wikilink that shouldnt be transformed
* [Code Blocks](Code Blocks) that shouldn't be rewritten into slugs
* [[FooBar]] wikilink that shouldnt produce a "unresolved" error

\*literal asterisks\*
_literal underscore_

Embedded link that should stay the same
![[Markdown Embedded Links File 2#Embed Section A in File 2]]

```


## 3) Simple fenced code blocks (common cases)

```js
// JavaScript example
function greet(name) {
  // A markdown-like link inside code MUST NOT be transformed:
  // [I am a link](https://example.com)
  console.log(`Hello, ${name}`);
}
```

```python
# Python block with wikilink-like text
# See: [[Some Note]] which should NOT be resolved
def add(a, b):
    return a + b
```

```html
<!-- HTML fence using ticks -->
<div class="widget">
  <a href="/docs/some-doc">This is an HTML anchor</a>
  <!-- This comment must remain intact -->
</div>
```

```
# Generic code fence with a markdown image-looking text:
![alt text](../images/should-not-be-parsed.png)
# This entire block must remain unchanged by the pipeline.
* Easy test: *bold*, **italics** - this should not be a dash entry
* [[Callouts]]

```

---

## 4) Nested and unusual fence lengths

Use longer fences to allow triple-backticks inside the content:

````markdown
```json
{
  "name": "example",
  "url": "https://example.com"
}
```
````

A fence with internal triple-ticks and language hint:

````bash
cat <<'EOF'
Here is a triple-backtick sequence inside a heredoc:
```
Not a fence for the parser (it's data)
```
EOF
````

---

## 5) Code blocks inside lists and blockquotes

- List item with fenced code:

  ```sh
  # inside a list item
  echo "Hello [world](https://example.com)"
  ```

> Blockquote containing a fenced block:
>
> ```sql
> SELECT * FROM users WHERE email LIKE '%@example.com';
> -- [commented link](https://should-not-transform)
> ```

---

## 6) HTML blocks at top-level (should be preserved verbatim)

<div class="raw-html-test">
  <p>This is a raw HTML block. It contains a markdown-like [link](../some-doc.md) and a wikilink [[Code Blocks]] which should not be touched.</p>
  <!-- HTML comment with [brackets] and [[wikilinks]] -->
</div>

<script type="text/javascript">
// This script block must remain unchanged and must not be parsed as markdown
console.log("A link-looking string: https://example.com?q=[notalink] or [[Callouts]]");
</script>

<!-- An iframe block -->

<iframe src="https://example.com" title="iframe test"></iframe>

---

## 7) Mixed content: markdown followed by HTML block immediately

Paragraph before HTML:

This paragraph contains a normal markdown inline link: [Docs Home](/docs/readme) — this **can** be processed normally.

But the following HTML block must be left untouched:

<div id="mixed">
  <p>Inside HTML: [this-is-not-a-markdown-link](../foo.md)</p>
  <p>Also contains a code snippet: <code>const x = `[should not change]`</code></p>
</div>

---

## 8) Reference-style links and link definitions (should be ignored if inside code)

Reference-style example (normal markdown):
[ref-link]: /docs/ref-target "Reference target"

And inside a code block (must not be resolved):

```text
This looks like a reference:
[ref-link]
```

---

## 9) Wiki-style and Obsidian-style constructs

These must be preserved verbatim when inside code blocks:

```md
- [[Obsidian Note]]
- [[Folder/SubNote|Display Text]]
- ![[image.png]]
```

Inline example (not in code) — should still be parsed normally:
See [Normal Note](/normal-note) (if your pipeline supports wiki-link processing).

---

## 10) Edge cases: HTML-like within inline code and attributes

Inline code containing angle brackets: `<div class="x">text</div>` => `` `<div class="x">text</div>` ``

A code fence containing Markdown tables (should be left as-is):

```text
| a | b |
|---|---|
| [link](../a) | [[note]] |
```

---

## 11) Final lines — clarifying expectations

- Everything between \`\`\` fences (or ~~~) must be emitted exactly as found.
- HTML blocks starting with `<` at the start of a line must be treated as raw HTML and written verbatim.
- Inline code spans (single backticks and longer variants) must not be altered.
- Your tests should assert that any text resembling `[link]`, `[[wikilink]]`, or `![image]` inside a code or HTML block remains byte-identical before & after the pipeline.
