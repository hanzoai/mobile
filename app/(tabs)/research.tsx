import { Button, ScrollView, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { RefreshControl } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Note, Refuse } from '@/components/tasks/note'
import * as research from '@/lib/research'
import { dim, fg } from '@/lib/theme'

function SectionLabel({ children }: { children: string }) {
  return (
    <Text color="$color11" fontSize={12} fontWeight="600" letterSpacing={1.2} mt="$2">
      {children.toUpperCase()}
    </Text>
  )
}

function Card({ title, subtitle, meta }: { title: string; subtitle: string; meta?: string }) {
  return (
    <YStack p="$3.5" rounded="$4" borderWidth={1} borderColor="$borderColor" gap="$1.5">
      <Text color="$color" fontSize={15} fontWeight="600">
        {title}
      </Text>
      <Text color="$color11" fontSize={13}>
        {subtitle}
      </Text>
      {meta ? (
        <Text color="$color10" fontSize={11}>
          {meta}
        </Text>
      ) : null}
    </YStack>
  )
}

export default function ResearchScreen() {
  const insets = useSafeAreaInsets()
  const [state, setState] = useState<research.LoadResearch | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setState(await research.load())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  const snap =
    state?.kind === 'ok'
      ? state.snapshot
      : state?.kind === 'refused'
        ? state.cached
        : undefined

  return (
    <ScrollView
      flex={1}
      bg="$background"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={dim} colors={[fg]} />
      }
      contentContainerStyle={{ p: 20, pt: insets.top + 16, pb: 32 }}
    >
      <YStack gap="$3">
        <XStack items="center" justify="space-between">
          <YStack gap="$1">
            <Text color="$color" fontSize={28} fontWeight="700">
              Research
            </Text>
            <Text color="$color11" fontSize={13}>
              Hanzo Dō · Hypotheses, desktop/cloud runs, Pareto frontier & XP
            </Text>
          </YStack>
        </XStack>

        {state === null ? (
          <XStack p="$4" justify="center">
            <Spinner color="$color11" />
          </XStack>
        ) : state.kind === 'anon' ? (
          <Note
            title="Signed out"
            detail="Sign in from Settings to view pre-registered hypotheses, desktop experiment progress, Evidence digests, and Hanzo XP."
          >
            <Button mt="$3" self="flex-start" size="$3" onPress={() => router.push('/(tabs)/settings')}>
              Open Settings
            </Button>
          </Note>
        ) : (
          <>
            {state.kind === 'refused' ? <Refuse refusal={state.refusal} /> : null}
            {snap ? (
              <>
                <SectionLabel>Verified XP (HIP-1402)</SectionLabel>
                {snap.xp.length === 0 ? (
                  <Note
                    title="0 XP earned yet"
                    detail="Soulbound reputation accrues only when candidates qualify or confirmatory claims replicate."
                  />
                ) : (
                  snap.xp.map((b) => (
                    <Card
                      key={b.principal}
                      title={`${b.principal} · ${b.total_xp} XP`}
                      subtitle={
                        Object.entries(b.domains)
                          .map(([d, v]) => `${d}: ${v}`)
                          .join(' · ') || 'non-transferable'
                      }
                    />
                  ))
                )}

                <SectionLabel>Experiments & Evidence Runs</SectionLabel>
                {snap.runs.length === 0 ? (
                  <Note
                    title="No recorded runs"
                    detail="Experiments executed on Desktop hanzod or Hanzo Cloud appear here with SHA-256 artifact digests."
                  />
                ) : (
                  snap.runs.map((r) => (
                    <Card
                      key={r.id}
                      title={`${r.id} · ${r.benchmark}`}
                      subtitle={
                        r.measures.map((m) => `${m.metric}=${m.value}`).join(' · ') ||
                        `system: ${r.system}`
                      }
                      meta={`completion: ${r.completion}${r.facts_digest ? ` · ${r.facts_digest.slice(0, 22)}…` : ''}`}
                    />
                  ))
                )}

                <SectionLabel>Claims & Replication (HIP-1403)</SectionLabel>
                {snap.claims.length === 0 ? (
                  <Note
                    title="No claims filed"
                    detail="Confirmatory claims start unreplicated and transition to replicated after independent verification."
                  />
                ) : (
                  snap.claims.map((c) => (
                    <Card
                      key={c.claim_id}
                      title={`${c.metric} = ${c.value} (${c.status.toUpperCase()})`}
                      subtitle={`mode: ${c.mode} · run: ${c.run_id} · replications: ${c.replications}`}
                      meta={c.claim_id}
                    />
                  ))
                )}

                <SectionLabel>Evolution Pareto Frontier (HIP-1401)</SectionLabel>
                {snap.frontier.length === 0 ? (
                  <Note
                    title="Empty frontier"
                    detail="Non-dominated EvolutionCandidates with zero safety violations appear here."
                  />
                ) : (
                  snap.frontier.map((c) => (
                    <Card
                      key={c.candidate_id}
                      title={`${c.mutation_surface} · ${c.status.toUpperCase()}`}
                      subtitle={
                        c.verified_success !== undefined
                          ? `success ${(c.verified_success * 100).toFixed(1)}% · $${(c.cost_per_success_usd ?? 0).toFixed(2)}/task`
                          : c.artifact_digest
                      }
                      meta={c.candidate_id}
                    />
                  ))
                )}

                <SectionLabel>Pre-Registered Hypotheses</SectionLabel>
                {snap.hypotheses.map((h) => (
                  <Card
                    key={h.hypothesis_id}
                    title={h.statement}
                    subtitle={`H₀: ${h.null_hypothesis}`}
                    meta={`seq #${h.seq} · ${h.gate_ref} · ${h.hypothesis_id.slice(0, 22)}…`}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </YStack>
    </ScrollView>
  )
}
