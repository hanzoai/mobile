const fs = require('node:fs')
const path = require('node:path')
const { withDangerousMod } = require('expo/config-plugins')

// Xcode 26.3+ with Swift C++20 interop imports C++ `<cmath>` `::abs(double)`
// alongside `Swift.abs(_:)` when compiling ExpoModulesJSI against React-jsi,
// making unqualified `abs(milliseconds)` in JavaScriptCodable+Date.swift
// ambiguous. Qualifying `Swift.abs(milliseconds)` during iOS prebuild fixes
// both local Xcode USB builds and unsigned CI Release archives without adding
// `patch_hash=` characters to pnpm virtual-store paths.
function patchDateSwiftSource(source) {
  return source.replace(
    /\bguard milliseconds\.isFinite,\s*abs\(milliseconds\)\s*<=\s*maxJavaScriptDateMilliseconds\b/,
    'guard milliseconds.isFinite, Swift.abs(milliseconds) <= maxJavaScriptDateMilliseconds'
  )
}

function applyExpoModulesJsiPatch(projectRoot) {
  let pkgJsonPath
  try {
    pkgJsonPath = require.resolve('expo-modules-jsi/package.json', { paths: [projectRoot] })
  } catch {
    return false
  }
  const target = path.join(
    path.dirname(pkgJsonPath),
    'apple',
    'Sources',
    'ExpoModulesJSI',
    'Coding',
    'JavaScriptCodable+Date.swift'
  )
  if (!fs.existsSync(target)) return false
  const current = fs.readFileSync(target, 'utf8')
  const next = patchDateSwiftSource(current)
  if (next !== current) {
    fs.writeFileSync(target, next, 'utf8')
    return true
  }
  return false
}

module.exports = function xcodeCompat(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      applyExpoModulesJsiPatch(cfg.modRequest.projectRoot)
      return cfg
    },
  ])
}

module.exports.patchDateSwiftSource = patchDateSwiftSource
module.exports.applyExpoModulesJsiPatch = applyExpoModulesJsiPatch
