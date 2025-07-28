# import-obsidian.ts - Script Specification Document

This document outlines the exact transformations that must occur when importing documentation files from an Obsidian style markdown docs vault into a Docusaurus documentation site.

In this instance the shell script will process:
- Source Docs located in  `../z2k-plugin-templates/docs` 
- Destination Docs located in `./docs`

This typescript script will be responsible for:
- Generally importing a collection of documents from an Obsidian markdown vault and make it ready for a Docusaurus build 
- Must support subfolders
- Must convert Obsidian style `[[wikilinks]]` and convert them to `[linkname](url)` syntax, with proper identification of the absolute or relative URL folder structure
- Must sluggify the names of files (it is safe to assume folders are already sluggified). If a file has a YAML property "slug:" it will use that instead
- Fully-resolved and Docusaurus-compatible `.md` output
- Proper folder structure, link resolution, and metadata
- Optional read-only enforcement on output files

---

## Source & Destination

- **Source**: `../z2k-plugin-templates/docs/`
  - May contain nested folders (e.g. `How-To Guides/`, `Reference Manual/`)
  - Authored in Obsidian format with wiki-style links
- **Destination**: `z2k-plugin-templates-docs/docs/`
  - Same folder structure is preserved
  - Output files are compatible with Docusaurus (no Obsidian-specific syntax remains)

---

## Exmaple Source Docs
For examples in this document, consider the following example source folder tree inside the `../z2k-plugin-templates/docs/` folder:

`./Reference Manual/`
    `Reference Manual.md`
    `./Overview/`
        `Overview.md` (*Assume this file has a yaml property `sidebar_position: 80`*)
        `Table of Contents.md`
`./How-To Guides/`
    `How-To Guides.md` (*Assume this file has a yaml properties `sidebar_position: 120` and `slug: "how-to"`*)
    `Learn Everything in 5 minutes.md`
    `Foo Bar.md` (*Assume this file has a yaml property `sidebar_position: 126`*)
    `An Image.png`

---

## Processing Steps

### 1. Clean Target Folder
- Delete all `.md` files in the destination docs folder to prevent stale files
- Optionally preserve `.gitkeep` or `_category_.json` files

---

### 2. Build File Index
- Recursively walk the source folder
- For each folder (in alphabetical order):
    - Determine the following items for the current folder name:
        - First determine the current folder's path. This is determine by copy the containing folder's finalized destination path.
        - If the folder consists of a number followed by a space or dash, then extract the number and use
        that number as the sidebar_position
        - Next, determine the current folder's "index" file within it. This can be `index.[md,txt]`, `Readme.[md,txt]`, `README.[md,txt]`, a .md or .txt file with the same name as the folder, or finally, a .md or .txt file with a sluggified version of the name of the folder. 
        - If it can find the index file, then the script will load the index file and extract `title`, `slug`, and `sidebar_position` properties and use these values for the folder itself.
        - If it can not find the folder's "index" file within it, or is missing one of the extracted yaml properties, then it assumes the following, sequentially:
            - The Folder's title name is the name of the source folder
            - The Folder's slug name is a sluggified version of the previously determined folder title name (which will come from the index' file's yaml property if present, otherwise it's filename)
            - The folder position should be 100 + the last folder position for the last folder found at the same depth as the current folder.
        - Finally it constructs a new destination folder name using the three digit (with leading zeros, "%03d" in C++ parlance), a `-`, and then the sluggified name

    - For each source doc file in each folder:
        - Determine the file's title name to be used in Docusaurus:
            - It first looks to see if the source doc has a yaml `title:` property. If it has it, then it uses this as its title name.
            - Otherwise, it uses the current source filename as its title name 
        - Next it determines and saves the slug name for the document:
            - It first looks to see if the source doc has a yaml `slug:` property. If it has it, then it uses this as the slug name.
            - Otherwise, it uses the previously determined title name of the document and sluggifies it, storing this as its new slug name.
        - Finally it determines the file position within the current folder:
            - It first looks to see if the source doc has a yaml `sidebar_position:`. If so, then it uses this as its position value
            - Otherwise, it stores a value of `-1` to signify that it is of unknown position.

- After a full source folder traversal, the program will now have an index of all files with the following items:
    - For each folder:
        - *Source Folder Data*:
            - Source folder path (e.g. `Reference Manual/`)
            - Source folder name (e.g. `Overview`)
        - *Destination Folder Data*:
            - Destination folder path (e.g. `reference-manual/`)
            - Destination folder sluggified name (e.g. `overview`)
            - A title name for each destination folder (e.g. "Overview")
            - A sidebar position of the folder (e.g. 80)
            - A final destination folder name (e.g. `80-overview`)

    - For each file:
        - *Source File Data*:
            - Source file path (e.g. `How-To Guides/`)
            - Source filename without extension (e.g. `Foo Bar`)
            - Source filename with extension (e.g. `Foo Bar.md`)
        - *Destination File Data*:
            - Destination file path (e.g. `how-to/`)
            - A title name for each destination file (e.g. `Foo Bar`)
            - A slug name for each destination file (e.g. `foo-bar.md`)
            - A sidebar position of the document, with `-1` signfying unknown. (e.g. `126`)

Note: the script will need to support non-.md and non-.txt files as well, but ignore all documents/folders beginning with a `.`. This is necessary in the even the documentation database includes images. Note: these documents should be able to be processed with the same exact indexing routine, with the exception of checking for yaml properties. 

Note: the script should perform a sanity check for any two files with the same "Source filename" entry, which is problematic for resolving `[[wikilinks]]`. If this occurs, output a warning.

---

### 3. Create the Docusaurus Docs Tree
Next, the script will use the generated index in order to create a destination docs tree in the docusaurus destination folder. 

For each folder in the index:
- It will create a folder in the destination folder. It is important to note that it will use the "final destination folder" name that uses both the sidebar position and the slug name for its destination, e.g. `z2k-plugin-templates/docs/reference-manual/80-overview`.

---

### 4. Copy & Transform Each File
Next, the script will use the generated index in order to import each source document and place it into the new docusaurus destination folder. 

For each file, it will:
1. Read the source file using the source file path and filename (e.g. `../z2k-plugin-templates/docs/How-To Guides/Foo Bar.md`)
2. Open for writing the destination file, using the destination file path and slug name (e.g. `z2k-plugin-templates-docs/docs/how-to/foo-bar.md`)
3. Uses remark to convert the Obsidian markdown into a Docusaurus friendly MDX format. Please seen note below for details.
4. Finally, in the destination file, it updates the YAML section, including:
- adding the `title:` and `slug:` properties *if they are not already present*. Note: it is important to check if these already exist in the source file, as there can only be one entry in the YAML section
- adding the `sidebar_position:` property, but only if a) it does not already exist in the yaml code, and b) if it is > 0.


#### 4a. Remark Actions
In step 3 above, here are the actions the script needs to do when using remark to change the contents of the source Obsidian markdown file:

a. Parse contents into an AST (via remark)
b. Rewrite `[[wikilinks]]` into `[Title](relative/path/to/target.md)`
	- Use the global index to resolve all links, looking through "Source filename without extension" to match the wikilink name (e.g. `[[Foo Bar]]`)
    - Then using the following construct:
        - "[destination title name]("/" + destination path + "/" + destination slug name)
        - e.g. `[Foo Bar](/how-to/foo-bar.md)`
	- Note: Maintain Obsidian semantics (case-insensitive matching preferred)

Please note to also:
- Support `[[Page#Section]]` with #section anchors
- Support `[[Page|Alt Name]]` syntax by over rinding the Title with the provided Alt Name in the transformed link
- Please Strip or normalize Obsidian-specific syntax for ^blockrefs

c. Fix any other Obsidian specific syntax or features 
-   Rewrite `![[Embeds]]` into `[Link Text](path.md)` (no embed)
-   Convert callouts (`> [!info]`) to fenced blocks or inline callouts

---

### 5. Set Output Permissions
	•	Make all copied .md files read-only:

```bash
chmod a-w target.md
```

### 6. Log Summary
	•	Output a summary table of:
        •	Number of files copied
        •	Number of wikilinks rewritten
        •	Any unresolved links (warnings)
        •	Title-to-path map (for debug)


