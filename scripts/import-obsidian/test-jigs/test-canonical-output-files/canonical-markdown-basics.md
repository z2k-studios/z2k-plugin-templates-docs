---
title: Test Jig - Basic Markdown - CANONICAL VERSION
slug: markdown-basics
sidebar_position: 10
hide_title: false
z2k-metadata-only: true
---
# Heading Level 1

Some normal paragraph text with **bold**, *italic*, and ==highlight==.

## Heading Level 2 with_underscore

More text with [a normal link](https://example.com) and\
a line break using two spaces.\
And a link to a file: [Helper Functions](Built-In Helper Functions.md)

### Heading Level 3

Multiline block quote:

> This is a quoted line.
> Still quoted.
>
> Another paragraph in the same quote.
>
> - and even a list item inside a quote
>   - nested child

## Horizontal rules:

---

---

Unordered lists:

- item dash 1
- item dash 2
  - nested child (3 spaces)
  - nested child (4 spaces)

* item star

- item plus

Ordered list:

1. First item
2. Second item
   1. Nested numbered
   2. Nested again

Inline `code` and code blocks:

```code
console.log(“fenced code block”);
    console.log("indented code block");
```

WikiLinks:
[Page](/page)
[Alias](/page)
[Section](/page#section)
[Alias](/page#section)

Links that look like URLs:
[https://github.com/Vinzent03/obsidian-advanced-uri](https://github.com/Vinzent03/obsidian-advanced-uri)

Task list:

- [ ] unchecked
- [x] checked

Tables:

| Col1 | Col2 |
|------|------|
| a    | b    |

Images:

![Alt text](image.png)

Escaping characters:
\*literal asterisks\*
_literal underscore_

Callouts (Obsidian style):

> [!note] This is a callout
> It has multiple lines
>
> - and even lists
