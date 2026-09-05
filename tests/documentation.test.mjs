import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.name === "reports") return [];
    const filename = join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(filename) : entry.name.endsWith(".md") ? [filename] : [];
  });
}

test("Markdown has balanced fences, unique headings and valid local links", () => {
  for (const filename of markdownFiles(".")) {
    const content = readFileSync(filename, "utf8");
    const fences = content.split("\n").filter((line) => /^```/.test(line));
    assert.equal(fences.length % 2, 0, `${filename}: unbalanced fenced block`);
    const headings = content.split("\n").filter((line) => /^#{1,6} /.test(line));
    assert.equal(new Set(headings).size, headings.length, `${filename}: duplicate heading`);
    assert.ok(content.endsWith("\n"), `${filename}: missing final newline`);
    for (const [, destination] of content.matchAll(/\]\(([^\s)]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(destination)) continue;
      const target = resolve(dirname(filename), destination.split("#")[0]);
      assert.ok(!relative(resolve("."), target).startsWith(".."), `${filename}: link escapes repository`);
      assert.ok(existsSync(target), `${filename}: missing link ${destination}`);
    }
  }
});
