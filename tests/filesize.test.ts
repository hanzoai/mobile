import fs from 'node:fs'
import path from 'node:path'

const MAX_LINES = 1000
const MAX_GEN_LINES = 220
const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', 'ios', 'android', 'dist'])
const SOURCE_EXTS = new Set(['.ts', '.tsx'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.isFile() && SOURCE_EXTS.has(path.extname(entry.name))) out.push(full)
  }
  return out
}

function linesOf(text: string): number {
  if (text.length === 0) return 0
  const parts = text.split('\n')
  return text.endsWith('\n') ? parts.length - 1 : parts.length
}

test('every .ts and .tsx file in hanzoai/mobile is <= 1,000 lines and lib/gen.ts is < 220 lines', () => {
  const root = path.resolve(__dirname, '..')
  const files = walk(root)
  expect(files.length).toBeGreaterThan(20)

  const overLimit: string[] = []
  for (const file of files) {
    const count = linesOf(fs.readFileSync(file, 'utf8'))
    if (count > MAX_LINES) {
      overLimit.push(`${path.relative(root, file)} (${count} lines > ${MAX_LINES})`)
    }
  }
  expect(overLimit).toEqual([])

  const genLines = linesOf(fs.readFileSync(path.join(root, 'lib/gen.ts'), 'utf8'))
  expect(genLines).toBeLessThan(MAX_GEN_LINES)
})
