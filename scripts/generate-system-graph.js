#!/usr/bin/env node
"use strict";

/**
 * Generates a Graphviz DOT file that links frontend service files
 * (frontend/src/services) to server route files (server/src/routes)
 * based on shared /api/v1/... endpoints.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.resolve(__dirname, "..");
const servicesDir = path.join(projectRoot, "frontend", "src", "services");
const serverIndexFile = path.join(projectRoot, "server", "src", "index.ts");
const outputDotFile = path.join(projectRoot, "system-graph.dot");

const routerFileCache = new Map();

const ROUTER_METHODS = ["get", "post", "put", "delete", "patch", "all", "use"];
const API_PATH_REGEX = /(['"`])\/api\/v1\/[^"'`]*\1/g;

try {
  main();
} catch (error) {
  console.error("[system-graph] Failed to generate graph:", error);
  process.exit(1);
}

function main() {
  assertExists(servicesDir, "frontend services directory");
  assertExists(serverIndexFile, "server index file");

  const serviceFiles = listTsFiles(servicesDir);
  const serviceEndpoints = collectServiceEndpoints(serviceFiles);

  const routerMounts = collectRouterMounts(serverIndexFile);
  const serverRoutes = buildServerRoutes(routerMounts);

  const graph = buildGraph(serviceEndpoints, serverRoutes);
  fs.writeFileSync(outputDotFile, graph, "utf8");

  console.log(
    `[system-graph] wrote ${outputDotFile.replace(
      `${projectRoot}${path.sep}`,
      "",
    )}`,
  );
}

function assertExists(targetPath, description) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Missing ${description}: ${targetPath}`);
  }
}

function listTsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listTsFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function collectServiceEndpoints(files) {
  const mapping = new Map();
  for (const filePath of files) {
    const text = fs.readFileSync(filePath, "utf8");
    const matches = new Set();
    let match;
    while ((match = API_PATH_REGEX.exec(text)) !== null) {
      const literal = match[0];
      const endpoint = literal.slice(1, -1);
      matches.add(endpoint);
    }
    if (matches.size > 0) {
      const relative = path.relative(projectRoot, filePath);
      mapping.set(relative, Array.from(matches).sort());
    }
  }
  return mapping;
}

function collectRouterMounts(indexFile) {
  const text = fs.readFileSync(indexFile, "utf8");
  const imports = parseRouteImports(indexFile, text);
  const mountPattern =
    /app\.use\(\s*(['"`])(\/api\/v1[^"'`]+)\1\s*,\s*([A-Za-z0-9_]+)\s*\)/g;
  const mounts = [];
  let match;
  while ((match = mountPattern.exec(text)) !== null) {
    const basePath = match[2];
    const identifier = match[3];
    const importInfo = imports.get(identifier);
    if (!importInfo) {
      continue;
    }
    mounts.push({
      basePath,
      identifier,
      filePath: importInfo.filePath,
      exportName: importInfo.exportName,
    });
  }
  return mounts;
}

function parseRouteImports(indexFile, text) {
  const imports = new Map();
  const importPattern =
    /import\s+([\s\S]+?)\s+from\s+["']([^"']+)["'];/gm;
  let match;
  while ((match = importPattern.exec(text)) !== null) {
    const clause = match[1].trim();
    const source = match[2];
    if (!source.startsWith("./routes")) {
      continue;
    }
    const filePath = resolveImportPath(indexFile, source);
    if (!filePath) {
      continue;
    }

    const parts = splitImportClause(clause);
    if (parts.default) {
      imports.set(parts.default, { filePath, exportName: "default" });
    }
    for (const named of parts.named) {
      imports.set(named.local, {
        filePath,
        exportName: named.imported,
      });
    }
  }
  return imports;
}

function splitImportClause(clause) {
  const result = { default: null, named: [] };
  if (clause.startsWith("{")) {
    result.named = parseNamedImports(clause);
    return result;
  }
  if (clause.includes("{")) {
    const [defaultPart, namedPart] = clause.split("{");
    result.default = defaultPart.replace(",", "").trim() || null;
    result.named = parseNamedImports(`{${namedPart}`);
    return result;
  }
  result.default = clause.replace(/,/g, "").trim() || null;
  return result;
}

function parseNamedImports(block) {
  const trimmed = block
    .replace(/^{/, "")
    .replace(/}$/, "")
    .trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const parts = chunk.split(/\s+as\s+/);
      return {
        imported: parts[0].trim(),
        local: (parts[1] || parts[0]).trim(),
      };
    });
}

function resolveImportPath(fromFile, importPath) {
  if (!importPath.startsWith(".")) {
    return null;
  }
  const baseDir = path.dirname(fromFile);
  const withoutExt = path.resolve(baseDir, importPath);
  const extensions = ["", ".ts", ".tsx", ".js", ".mjs", ".cjs"];
  for (const ext of extensions) {
    const candidate = withoutExt + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function buildServerRoutes(routerMounts) {
  const routeEntries = [];
  for (const mount of routerMounts) {
    const parsed = loadRouterFile(mount.filePath);
    const localName =
      parsed.exports.get(mount.exportName) ?? mount.exportName;
    const routes = parsed.routesByLocal.get(localName) ?? [];
    if (routes.length === 0) {
      routeEntries.push({
        filePath: mount.filePath,
        fullPath: mount.basePath,
        method: "USE",
      });
      continue;
    }
    for (const route of routes) {
      const fullPath = joinPaths(mount.basePath, route.subPath);
      routeEntries.push({
        filePath: mount.filePath,
        fullPath,
        method: route.method,
      });
    }
  }

  const lookup = new Map();
  for (const entry of routeEntries) {
    if (!lookup.has(entry.fullPath)) {
      lookup.set(entry.fullPath, []);
    }
    lookup.get(entry.fullPath).push(entry);
  }
  return {
    entries: routeEntries,
    lookup,
  };
}

function loadRouterFile(filePath) {
  if (routerFileCache.has(filePath)) {
    return routerFileCache.get(filePath);
  }
  const text = fs.readFileSync(filePath, "utf8");

  const routerLocals = collectRouterLocals(text);
  const routesByLocal = new Map();
  for (const local of routerLocals) {
    routesByLocal.set(local, collectLocalRoutes(text, local));
  }

  const exportsMap = collectExportMap(text);

  const parsed = { exports: exportsMap, routesByLocal };
  routerFileCache.set(filePath, parsed);
  return parsed;
}

function collectRouterLocals(text) {
  const locals = new Set();
  const pattern =
    /(?:const|let|var|export\s+const)\s+([A-Za-z0-9_]+)\s*=\s*(?:express\.)?Router\s*\(/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    locals.add(match[1]);
  }
  return locals;
}

function collectLocalRoutes(text, local) {
  const routes = [];
  const methodPattern = ROUTER_METHODS.join("|");
  const regex = new RegExp(
    `${escapeRegExp(local)}\\s*\\.\\s*(${methodPattern})\\s*\\(\\s*(['"\`])([^"'\\\`]+)\\2`,
    "g",
  );
  let match;
  while ((match = regex.exec(text)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      subPath: match[3],
    });
  }
  return routes;
}

function collectExportMap(text) {
  const exportsMap = new Map();

  const directPattern = /export\s+const\s+([A-Za-z0-9_]+)/g;
  let match;
  while ((match = directPattern.exec(text)) !== null) {
    const name = match[1];
    if (!exportsMap.has(name)) {
      exportsMap.set(name, name);
    }
  }

  const aliasPattern = /export\s*{\s*([^}]+)\s*}/g;
  while ((match = aliasPattern.exec(text)) !== null) {
    const block = match[1];
    const chunks = block.split(",").map((chunk) => chunk.trim()).filter(Boolean);
    for (const chunk of chunks) {
      const parts = chunk.split(/\s+as\s+/);
      if (parts.length === 2) {
        exportsMap.set(parts[1].trim(), parts[0].trim());
      } else {
        exportsMap.set(parts[0], parts[0]);
      }
    }
  }

  const defaultPattern = /export\s+default\s+([A-Za-z0-9_]+)/g;
  while ((match = defaultPattern.exec(text)) !== null) {
    exportsMap.set("default", match[1]);
  }

  return exportsMap;
}

function joinPaths(base, subPath) {
  if (!subPath || subPath === "/") {
    return base;
  }
  const sanitizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const sanitizedSub = subPath.startsWith("/")
    ? subPath.slice(1)
    : subPath;
  return `${sanitizedBase}/${sanitizedSub}`;
}

function buildGraph(serviceEndpoints, serverRoutes) {
  const serviceNodes = new Map();
  const routeNodes = new Map();
  const missingNodes = new Map();

  const edges = [];

  for (const [serviceFile, endpoints] of serviceEndpoints.entries()) {
    const serviceId = makeNodeId("svc", serviceFile);
    serviceNodes.set(serviceFile, serviceId);

    for (const endpoint of endpoints) {
      const matches = serverRoutes.lookup.get(endpoint);
      if (matches && matches.length) {
        for (const match of matches) {
          const routeFile = path.relative(projectRoot, match.filePath);
          const routeId =
            routeNodes.get(routeFile) ?? makeNodeId("route", routeFile);
          routeNodes.set(routeFile, routeId);
          edges.push({
            from: serviceId,
            to: routeId,
            label: `${endpoint} [${match.method}]`,
          });
        }
      } else {
        const missingId =
          missingNodes.get(endpoint) ?? makeNodeId("missing", endpoint);
        missingNodes.set(endpoint, missingId);
        edges.push({
          from: serviceId,
          to: missingId,
          label: `${endpoint} [missing]`,
        });
      }
    }
  }

  return renderDot({
    serviceNodes,
    routeNodes,
    missingNodes,
    edges,
  });
}

function renderDot({ serviceNodes, routeNodes, missingNodes, edges }) {
  const lines = [];
  lines.push("digraph SystemGraph {");
  lines.push('  rankdir=LR;');
  lines.push('  fontname="Helvetica";');
  lines.push('  node [shape=box, fontname="Helvetica"];');

  lines.push("  subgraph cluster_frontend {");
  lines.push('    label="frontend services";');
  lines.push('    color="#8FC1E3";');
  lines.push("    style=filled;");
  lines.push('    fillcolor="#E8F4FB";');
  for (const [file, nodeId] of serviceNodes.entries()) {
    lines.push(
      `    ${nodeId} [label="${escapeLabel(file)}", fillcolor="#ffffff"];`,
    );
  }
  lines.push("  }");

  lines.push("  subgraph cluster_server {");
  lines.push('    label="server routes";');
  lines.push('    color="#A0D995";');
  lines.push("    style=filled;");
  lines.push('    fillcolor="#F1FAF0";');
  for (const [file, nodeId] of routeNodes.entries()) {
    lines.push(
      `    ${nodeId} [label="${escapeLabel(file)}", fillcolor="#ffffff"];`,
    );
  }
  lines.push("  }");

  if (missingNodes.size > 0) {
    lines.push("  subgraph cluster_missing {");
    lines.push('    label="unmatched endpoints";');
    lines.push('    color="#F6B8B8";');
    lines.push("    style=filled;");
    lines.push('    fillcolor="#FFF5F5";');
    for (const [endpoint, nodeId] of missingNodes.entries()) {
      lines.push(
        `    ${nodeId} [label="${escapeLabel(endpoint)}", shape=ellipse, fillcolor="#ffffff"];`,
      );
    }
    lines.push("  }");
  }

  for (const edge of edges) {
    lines.push(
      `  ${edge.from} -> ${edge.to} [label="${escapeLabel(edge.label)}"];`,
    );
  }

  lines.push("}");
  return lines.join("\n");
}

function makeNodeId(prefix, key) {
  const safeFragment = key.replace(/[^A-Za-z0-9]+/g, "_");
  const hash = crypto.createHash("md5").update(key).digest("hex").slice(0, 6);
  return `${prefix}_${safeFragment}_${hash}`;
}

function escapeLabel(label) {
  return label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
