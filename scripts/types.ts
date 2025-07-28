// ----------------------------------------------------------------------------------------------------
// --- Types ---
// ----------------------------------------------------------------------------------------------------

export type FileIndexEntry = {
  sourcePath: string;
  sourceDir: string;
  sourceName: string;
  sourceExt: string;
  destDir: string;
  destSlug: string;
  destTitle: string;
  sidebarPosition: number;
  hasYamlTitle: boolean;
  hasYamlSlug: boolean;
  hasYamlSidebar: boolean;
};

export type FolderIndexEntry = {
  sourcePath: string;
  sourceName: string;
  destDir: string;
  destSlug: string;
  destTitle: string;
  sidebarPosition: number;
  finalDestFolder: string;
};

export type Index = {
  files: FileIndexEntry[];
  folders: FolderIndexEntry[];
  fileTitleMap: Map<string, FileIndexEntry>;
  fileSlugMap: Map<string, FileIndexEntry>;
  fileNameMap: Map<string, FileIndexEntry[]>;
};

export type Summary = {
  filesCopied: number;
  wikilinksRewritten: number;
  unresolvedLinks: number;
};