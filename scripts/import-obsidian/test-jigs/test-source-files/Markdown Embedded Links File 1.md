---
title: Test Jig - Embedded Links (File 1)
slug: markdown-embedded-links-file-1
sidebar_position: 30
hide_title: false
z2k-metadata-only: true
---
# Basic Cross file Wikilink Testing in File 1

Intra-file Header Wikilinks:

- [[#Header 2 in File 1]]
- [[#Header 2 in File 1|See Header 2]]
- [[#^note|Caret note alias]]

Cross-file links - Basic:

- Link to [[Markdown Embedded Links File 2#Linkto Section A in File 2]]
- Link to [[Markdown Embedded Links File 2.md#Linkto Section A in File 2]]
- Link to [[Markdown Embedded Links File 2#Linkto Section B in File 2!]]

Cross-file links - Explicit alias so display is clean:

- [[Markdown Embedded Links File 2#Linkto Section A in File 2|Linkto A (with no file ext)]]
- [[Markdown Embedded Links File 2.md#Linkto Section A in File 2|Linkto A (explicit)]]

Cross-file links - Using destination Slug:

- [[markdown-embedded-links-file-2-slug#Linkto Section A in File 2]]
- [[markdown-embedded-links-file-2-slug.md#Linkto Section A in File 2]]

Cross-file links - Using destination slug AND alias:

- [[markdown-embedded-links-file-2-slug#Linkto Section A in File 2|Embed A (with no file ext)]]
- [[markdown-embedded-links-file-2-slug.md#Linkto Section A in File 2|Embed A (explicit)]]

---

# Embedding within the same file

*Self-embed of a section:*
![[#Header 2 in File 1]]

*Self-embed of a section with filename:*
![[Markdown Embedded Links File 1#Header 2 in File 1]]

*Self-embed of a section with slug name:*
![[markdown-embedded-links-file-1#Header 2 in File 1]]


# Embedded Cross Links in File 1 of all of File 2

---
*Embed the whole File 2 here*:
![[Markdown Embedded Links File 2]]
---
*Embed the whole File 2 here via slug*:
![[markdown-embedded-links-file-2-slug]]


# Embedded Cross Links in File 1 of a section of file 2

---
*Embed a single section from File 2*:
![[Markdown Embedded Links File 2#Embed Section A in File 2]]
---
*Embed a single section from File 2 via slug name*:
![[markdown-embedded-links-file-2-slug#Embed Section A in File 2]]
---
*Embed a single section from File 2 that has a illegal character*:
*Note: Obsidian will NOT drop the illegal char when making the link*
![[Markdown Embedded Links File 2#Linkto Section B in File 2!]]
---




# Header 2 in File 1

Some text under header 2 in File 1

---

# Advanced Tests in File 1

Embedding a wikilink to a non-existent page (should become a fallback link):
![[NoSuchPage]]
