---
title: Test Jig - Embedded Links (File 2)
slug: markdown-embedded-links-file-2-slug
sidebar_position: 35
hide_title: false
z2k-metadata-only: true
---

# Linkto Section A in File 2
- This section is just for testing cross-links to a section

# Linkto Section B in File 2!
- Content for header with punctuation — slug should drop punctuation when slugified.


---


# Embed Section A in File 2

Intro paragraph for Embed Section A.

- Local reference (in original file): [[#Embed Subheader in File 2]]
- Local reference with alias: [[#Embed Subheader in File 2|See Subheader]]
- Caret-style anchor (local): [[#^note]]
- Regular page link (other page): [[callouts]] and [[markdown-embedded-links-file-1|Embedded Links File 1]]

## Embed Subheader in File 2

This is the subheader content. It has a bit of text and a small list:

- item one
- item two


---

# Extra Section in File 2

Some text. Contains a local header-only link: [[#Linkto Section B in File 2!|Go to Another Header]]