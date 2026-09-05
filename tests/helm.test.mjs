import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("Helm rejects empty secrets and isolates two releases in one namespace", { skip: process.env.BLAKDNA_ISOLATED_PREFLIGHT_TESTS !== "1" }, () => {
  for (const field of ["runtimeSecret.name", "runtimeSecret.databasePasswordKey"]) {
    assert.throws(() => execFileSync("helm", ["template", "first", "charts/blakdna", "-f", "tests/validation-values.yaml", "--set-string", `${field}=`], { stdio: "pipe" }));
  }
  for (const release of ["first", "second"]) {
    const rendered = execFileSync("helm", ["template", release, "charts/blakdna", "-f", "tests/validation-values.yaml"], { encoding: "utf8" });
    const documents = JSON.parse(execFileSync("python3", ["-c", "import json,sys,yaml; json.dump(list(yaml.safe_load_all(sys.stdin)),sys.stdout)"], { input: rendered, encoding: "utf8" }));
    for (const resource of documents) {
      if (resource.kind === "Deployment") {
        assert.equal(resource.spec.replicas, 0);
        assert.equal(resource.spec.selector.matchLabels["app.kubernetes.io/instance"], release);
        assert.equal(resource.spec.template.metadata.labels["app.kubernetes.io/instance"], release);
      }
      if (resource.kind === "Service") assert.equal(resource.spec.selector["app.kubernetes.io/instance"], release);
      if (resource.kind === "PodDisruptionBudget") assert.equal(resource.spec.selector.matchLabels["app.kubernetes.io/instance"], release);
    }
  }
});
