import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')

function readPngSize(filePath: string): { width: number; height: number; sha256: string; bytes: number } {
  const buf = fs.readFileSync(filePath)
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    bytes: buf.length,
  }
}

test('package.json and app.json versions match v2.3.5+ and enforce pure #000000 ground', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { version: string }
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')) as {
    expo: {
      version: string
      icon: string
      backgroundColor: string
      ios?: { icon?: string }
      android?: { adaptiveIcon?: { backgroundColor?: string } }
    }
  }
  expect(pkg.version).toBe(appJson.expo.version)
  expect(pkg.version).toBe('2.3.5')
  expect(appJson.expo.backgroundColor).toBe('#000000')
  expect(appJson.expo.android?.adaptiveIcon?.backgroundColor).toBe('#000000')
  expect(appJson.expo.icon).toBe('./assets/icon.png')
  expect(appJson.expo.ios?.icon).toBeUndefined()
})

test('canonical Obsidian Glass Squircle icons are synced across assets/icon.png and assets/adaptive-icon.png', () => {
  const icon = readPngSize(path.join(ROOT, 'assets/icon.png'))
  const adaptive = readPngSize(path.join(ROOT, 'assets/adaptive-icon.png'))
  const imagesIcon = readPngSize(path.join(ROOT, 'assets/images/icon.png'))

  expect(icon.width).toBe(1024)
  expect(icon.height).toBe(1024)
  expect(icon.bytes).toBeGreaterThan(40_000)
  expect(adaptive.sha256).toBe(icon.sha256)
  expect(imagesIcon.sha256).toBe(icon.sha256)
})

test('app/auth.tsx is wordmark-free centered pure-black login with Google, GitHub, Hanzo ID, API key & guest entry', () => {
  const auth = fs.readFileSync(path.join(ROOT, 'app/auth.tsx'), 'utf8')
  expect(auth).toContain('bg="#000000"')
  expect(auth).not.toMatch(/>\s*hanzo\s*<\/Text>/)
  expect(auth).toContain('<HanzoAppSquircle size={64} />')
  expect(auth).toContain('Sign in to Hanzo')
  expect(auth).toContain('Continue with Google')
  expect(auth).toContain('Continue with GitHub')
  expect(auth).toContain('Continue with Hanzo ID')
  expect(auth).toContain('Use API key')
  expect(auth).toContain('Continue without signing in')
  expect(auth).toContain('exchangeCodeAsync(')
  expect(auth).toContain("v1('/models')")

  const chat = fs.readFileSync(path.join(ROOT, 'components/chat/chat.tsx'), 'utf8')
  expect(chat).toContain("router.replace('/auth')")
})

test('app/(tabs)/settings.tsx implements shared @hanzo/gui Hanzo Dev grouped settings design', () => {
  const settings = fs.readFileSync(path.join(ROOT, 'app/(tabs)/settings.tsx'), 'utf8')
  const primitives = fs.readFileSync(path.join(ROOT, 'components/settings/primitives.tsx'), 'utf8')
  expect(primitives).toContain("SETTINGS_CARD_BG = '#0d0d10'")
  expect(primitives).toContain("SETTINGS_CARD_BORDER = 'rgba(255,255,255,0.08)'")
  expect(primitives).toContain('rounded="$4"')
  expect(primitives).toContain('title.toUpperCase()')
  for (const group of ['Account', 'Appearance', 'Models & API', 'Local Node', 'About']) {
    expect(settings).toContain(`title: '${group}'`)
  }
  expect(settings).toContain('<SettingsSearchInput')
})
