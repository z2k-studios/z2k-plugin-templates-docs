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
   */
  fileTitleMap: Map<string, FileIndexEntry>;

  /**
   * fileSlugMap: slug → file (case-insensitive)
   */
  fileSlugMap: Map<string, FileIndexEntry>;

  /**
   * fileNameMap: filename → [files] (case-insensitive, allows duplicates)
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
