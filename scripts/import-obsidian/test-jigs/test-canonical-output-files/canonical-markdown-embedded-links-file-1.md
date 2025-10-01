---
title: Test Jig - Embedded Links (File 1) - CANONICAL VERSION
slug: markdown-embedded-links-file-1
sidebar_position: 30
hide_title: false
z2k-metadata-only: true
---
# Basic Cross file Wikilink Testing in File 1

Intra-file Header Wikilinks:

- [Header 2 in File 1](#header-2-in-file-1)
- [See Header 2](#header-2-in-file-1)
- [Caret note alias](#^note)

Cross-file links - Basic:

- Link to [Linkto Section A in File 2](/markdown-embedded-links-file-2-slug#linkto-section-a-in-file-2)
- Link to [Linkto Section A in File 2](/markdown-embedded-links-file-2-slug#linkto-section-a-in-file-2)
- Link to [Linkto Section B in File 2!](/markdown-embedded-links-file-2-slug#linkto-section-b-in-file-2)

Cross-file links - Explicit alias so display is clean:

- [Linkto A (with no file ext)](/markdown-embedded-links-file-2-slug#linkto-section-a-in-file-2)
- [Linkto A (explicit)](/markdown-embedded-links-file-2-slug#linkto-section-a-in-file-2)

Cross-file links - Using destination Slug:

- [Linkto Section A in File 2](/markdown-embedded-links-file-2-slug#linkto-section-a-in-file-2)
- [Linkto Section A in File 2](/markdown-embedded-links-file-2-slug#linkto-section-a-in-file-2)

Cross-file links - Using destination slug AND alias:

- [Embed A (with no file ext)](/markdown-embedded-links-file-2-slug#linkto-section-a-in-file-2)
- [Embed A (explicit)](/markdown-embedded-links-file-2-slug#linkto-section-a-in-file-2)

---

# Embedding within the same file

*Self-embed of a section:*

# Header 2 in File 1

Some text under header 2 in File 1

---

*Self-embed of a section with filename:*

# Header 2 in File 1

Some text under header 2 in File 1

---

*Self-embed of a section with slug name:*

# Header 2 in File 1

Some text under header 2 in File 1

---

# Embedded Cross Links in File 1 of all of File 2

---

*Embed the whole File 2 here*:

# Linkto Section A in File 2

- This section is just for testing cross-links to a section

# Linkto Section B in File 2!

- Content for header with punctuation — slug should drop punctuation when slugified.

---

# Embed Section A in File 2

Intro paragraph for Embed Section A.

- Local reference (in original file): [Embed Subheader in File 2](/markdown-embedded-links-file-2-slug#embed-subheader-in-file-2)
- Local reference with alias: [See Subheader](/markdown-embedded-links-file-2-slug#embed-subheader-in-file-2)
- Caret-style anchor (local): [^note](/markdown-embedded-links-file-2-slug#^note)
- Regular page link (other page): [callouts](/callouts) and [Embedded Links File 1](/markdown-embedded-links-file-1)

## Embed Subheader in File 2

This is the subheader content. It has a bit of text and a small list:

- item one
- item two

---

# Extra Section in File 2

## Some text. Contains a local header-only link: [Go to Another Header](/markdown-embedded-links-file-2-slug#linkto-section-b-in-file-2)

*Embed the whole File 2 here via slug*:

# Linkto Section A in File 2

- This section is just for testing cross-links to a section

# Linkto Section B in File 2!

- Content for header with punctuation — slug should drop punctuation when slugified.

---

# Embed Section A in File 2

Intro paragraph for Embed Section A.

- Local reference (in original file): [Embed Subheader in File 2](/markdown-embedded-links-file-2-slug#embed-subheader-in-file-2)
- Local reference with alias: [See Subheader](/markdown-embedded-links-file-2-slug#embed-subheader-in-file-2)
- Caret-style anchor (local): [^note](/markdown-embedded-links-file-2-slug#^note)
- Regular page link (other page): [callouts](/callouts) and [Embedded Links File 1](/markdown-embedded-links-file-1)

## Embed Subheader in File 2

This is the subheader content. It has a bit of text and a small list:

- item one
- item two

---

# Extra Section in File 2

Some text. Contains a local header-only link: [Go to Another Header](/markdown-embedded-links-file-2-slug#linkto-section-b-in-file-2)

# Embedded Cross Links in File 1 of a section of file 2

---

*Embed a single section from File 2*:

# Embed Section A in File 2

Intro paragraph for Embed Section A.

- Local reference (in original file): [Embed Subheader in File 2](/markdown-embedded-links-file-2-slug#embed-subheader-in-file-2)
- Local reference with alias: [See Subheader](/markdown-embedded-links-file-2-slug#embed-subheader-in-file-2)
- Caret-style anchor (local): [^note](/markdown-embedded-links-file-2-slug#^note)
- Regular page link (other page): [callouts](/callouts) and [Embedded Links File 1](/markdown-embedded-links-file-1)

## Embed Subheader in File 2

This is the subheader content. It has a bit of text and a small list:

- item one
- item two

---

---

*Embed a single section from File 2 via slug name*:

# Embed Section A in File 2

Intro paragraph for Embed Section A.

- Local reference (in original file): [Embed Subheader in File 2](/markdown-embedded-links-file-2-slug#embed-subheader-in-file-2)
- Local reference with alias: [See Subheader](/markdown-embedded-links-file-2-slug#embed-subheader-in-file-2)
- Caret-style anchor (local): [^note](/markdown-embedded-links-file-2-slug#^note)
- Regular page link (other page): [callouts](/callouts) and [Embedded Links File 1](/markdown-embedded-links-file-1)

## Embed Subheader in File 2

This is the subheader content. It has a bit of text and a small list:

- item one
- item two

---

---

*Embed a single section from File 2 that has a illegal character*:
*Note: Obsidian will NOT drop the illegal char when making the link*

# Linkto Section B in File 2!

- Content for header with punctuation — slug should drop punctuation when slugified.

---

---

# Header 2 in File 1

Some text under header 2 in File 1

---

# Advanced Tests in File 1

Embedding a wikilink to a non-existent page (should become a fallback link):

> **Missing embed: NoSuchPage**
