---
title: Test Jig - Embedded Links - CANONICAL VERSION
slug: /markdown-embedded-links2 
sidebar_position: 35
hide_title: false
z2k-metadata-only: true
---
# Embed Section A

Intro paragraph for Embed Section A.

- Local reference (in original file): [Embed Subheader](#embed-subheader)
- Local reference with alias: [See Subheader](#embed-subheader)
- Caret-style anchor (local): [^note](#^note)
- Regular page link (other page): [SomeOtherPage](/somesomepage)  <-- (fallback to slugified path; exact slug depends on your filename map)

## Embed Subheader

This is the subheader content. It has a bit of text and a small list:

- item one
- item two

# Another Header!

Content for header with punctuation — slug should drop punctuation when slugified.

---

# Extra Section

Some text. Contains a local header-only link: [Go to Another Header](#another-header)