import { base, currentBase, v1 } from '@/lib/api'
import * as gen from '@/lib/gen'
import * as prefs from '@/lib/prefs'

beforeEach(() => {
  prefs.resetForTests()
})

test('prefs.update syncs custom API gateway into lib/api and local hanzod endpoint into lib/gen', async () => {
  expect(currentBase()).toBe(base)
  expect(gen.endpoint()).toBeNull()

  await prefs.update({
    apiBase: 'https://gateway.example.com/',
    localNodeEnabled: true,
    localNodeUrl: 'http://192.168.1.42:3690/',
  })

  expect(currentBase()).toBe('https://gateway.example.com')
  expect(v1('/models')).toBe('https://gateway.example.com/v1/models')
  expect(gen.endpoint()).toBe('http://192.168.1.42:3690')

  await prefs.update({ localNodeEnabled: false })
  expect(gen.endpoint()).toBeNull()
})

test('filterSettingsGroups filters sections by group title, row label, subtitle, or value', () => {
  const groups = [
    {
      title: 'Account',
      rows: [
        { id: '1', label: 'Hanzo Account', subtitle: 'dev@hanzo.ai', value: 'Hanzo ID' },
        { id: '2', label: 'Credential Storage', subtitle: 'SecureStore', value: 'Active' },
      ],
    },
    {
      title: 'Local Node',
      rows: [
        { id: '3', label: 'Use Local hanzod Node', subtitle: 'LAN coding sessions', value: 'Off' },
      ],
    },
  ]

  expect(prefs.filterSettingsGroups(groups, '')).toHaveLength(2)
  expect(prefs.filterSettingsGroups(groups, 'hanzod')).toEqual([groups[1]])
  expect(prefs.filterSettingsGroups(groups, 'securestore')[0]?.rows).toHaveLength(1)
  expect(prefs.filterSettingsGroups(groups, 'account')[0]?.rows).toHaveLength(2)
  expect(prefs.filterSettingsGroups(groups, 'nonexistent')).toEqual([])
})
