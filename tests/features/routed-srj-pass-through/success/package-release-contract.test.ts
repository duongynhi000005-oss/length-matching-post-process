import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { DifferentialPairSolver } from "../../../../lib"

test("package metadata and documentation are reproducible without machine-specific paths", () => {
  const pkgRaw = readFileSync("./package.json", "utf8")
  const readmeRaw = readFileSync("./README.md", "utf8")
  const pkg = JSON.parse(pkgRaw) as {
    name: string
    files: string[]
    scripts: Record<string, string>
    exports: Record<string, unknown>
  }

  expect(pkg.files).toContain("dist")
  expect(pkg.files).toContain("lib")
  expect(pkg.scripts.build).toContain("--dts")
  expect(pkg.scripts.prepublishOnly).toBe("bun run build")
  expect(pkg.exports["."]).toBeDefined()
  expect(typeof DifferentialPairSolver).toBe("function")

  expect(pkgRaw).not.toMatch(/\/home\/|file:|link:/)
  expect(readmeRaw).toContain(
    "https://github.com/tscircuit/length-matching-post-process/issues/1",
  )
})
