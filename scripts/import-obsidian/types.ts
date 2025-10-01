// ----------------------------------------------------------------------------------------------------
// --- Types for File and Folder Indexing ---
// ----------------------------------------------------------------------------------------------------

/**
 * Represents an indexed file within the documentation/content tree.
 * A file entry includes both its source properties and the computed
 * destination properties (used for slugs, sidebar organization, etc.).
 */
export type FileIndexEntry = {
  sourcePath: string;          // Absolute path to the file in the source directory
  sourceDir: string;           // Absolute path of the parent directory that contains this file
  sourceName: string;          // Base filename without extension (e.g. "readme")
  sourceExt: string;           // File extension (e.g. ".md", ".txt")

  destDir: string;             // Destination directory path (relative to the build root) where this file will be copied
  destSlug: string;            // Destination slug (URL-safe identifier, includes extension to ensure uniqueness)
  destTitle: string;           // Display title, pulled from YAML frontmatter or fallback to filename

  sidebarPosition: number;     // Sidebar ordering position of this file within its folder (-1 if unspecified)

  hasYamlTitle: boolean;       // True if `title` came explicitly from YAML
  hasYamlSlug: boolean;        // True if `slug` came explicitly from YAML
  hasYamlSidebar: boolean;     // True if `sidebar_position` came explicitly from YAML

  // ---------- Normalized / derived destination fields (added by step2) ----------
  normalizedDestDir?: string;  // posix-normalized destDir (no leading/trailing slash). Used for grouping/lookup.
  docId?: string;              // canonical doc id (destDir + '/' + stripExt(destSlug)), no leading slash, no extension
  normalizedDestPath?: string; // posix-normalized destDir + '/' + destSlug (includes extension)
};

/**
 * Represents an indexed folder within the documentation/content tree.
 * A folder entry can have its own title/slug and sidebar position,
 * usually derived from its index file or naming convention.
 */
export type FolderIndexEntry = {
  sourcePath: string;          // Absolute path to the folder in the source directory
  sourceName: string;          // Raw folder name (e.g. "01-Introduction")

  destDir: string;             // Destination directory path (relative to the build root)
  destSlug: string;            // Destination slug (URL-safe identifier for the folder)
  destTitle: string;           // Display title for the folder, often from index.md frontmatter

  sidebarPosition: number;     // Sidebar ordering of this folder relative to its siblings
  finalDestFolder: string;     // Final destination folder name after numbering + sluggification (e.g. "010-getting-started")

  // normalized destination directory (posix, no leading/trailing slash)
  normalizedDestDir?: string;
};

/**
 * Global index structure returned by the build process.
 * Contains arrays of all files/folders and lookup maps for fast resolution.
 */
export type Index = {
  files: FileIndexEntry[];     // All indexed files with metadata
  folders: FolderIndexEntry[]; // All indexed folders with metadata

  /**
   * fileTitleMap: title → file (case-insensitive)
   *
   * Resolves files by their *YAML title* if provided, otherwise by
   * the fallback title inferred from the filename.
   *
   * Good for: human-friendly link resolution (e.g. [[Getting Started]]).
   * Risk: titles are not unique; multiple files can share the same title.
   *
   * Example:
   *   File: docs/intro.md
   *   YAML: title: "Getting Started"
   *   Lookup: fileTitleMap.get("getting started") → FileIndexEntry for intro.md
   */
  fileTitleMap: Map<string, FileIndexEntry>;

  /**
   * fileSlugMap: slug → file (case-insensitive)
   *
   * Resolves files by their *slug*, which is a URL-safe identifier
   * derived from YAML `slug` if given, otherwise from the filename.
   *
   * Good for: stable references in documentation systems,
   * because slugs remain consistent even if display titles change.
   *
   * Example:
   *   File: docs/intro.md
   *   YAML: slug: "getting-started"
   *   Lookup: fileSlugMap.get("getting-started") → FileIndexEntry for intro.md
   */
  fileSlugMap: Map<string, FileIndexEntry>;

  /**
   * fileNameMap: filename → [files] (case-insensitive, allows duplicates)
   *
   * Resolves files by their *raw filename* (without extension).
   * Unlike the other maps, this may return multiple files if
   * different folders contain files with the same name.
   *
   * Good for: wikilink resolution when a user writes [[readme]]
   * without specifying a path. Caller must disambiguate if more
   * than one match is returned.
   *
   * Example:
   *   docs/guide/readme.md
   *   docs/setup/readme.md
   *   Lookup: fileNameMap.get("readme") → [FileIndexEntry for guide/readme.md,
   *                                         FileIndexEntry for setup/readme.md]
   */
  fileNameMap: Map<string, FileIndexEntry[]>;

  /**
   * folderMap: normalizedDestDir -> FolderIndexEntry
   *
   * Convenience map produced by step2 for downstream steps that wish to
   * quickly resolve folder metadata by the destination directory key.
   */
  folderMap?: Map<string, FolderIndexEntry>;
};

/**
 * Summary statistics produced during a documentation migration or copy run.
 * Useful for reporting and debugging pipeline execution.
 */
export type Summary = {
  filesCopied: number;         // Number of files successfully copied to the destination
  wikilinksRewritten: number;  // Number of wikilinks rewritten during processing
  unresolvedLinks: number;     // Number of links that could not be resolved to a valid file
};
