import { Card, Text } from '@hanzo/gui'
import type { ReactNode } from 'react'

import type { Refusal } from '@/lib/api'

// The honest card for anything that is not rows: empty, signed out, refused.
// Same skin as components/empty minus the full-screen centering, so it can
// sit inside a section.
export function Note({
  title,
  detail,
  children,
}: {
  title: string
  detail: string
  children?: ReactNode
}) {
  return (
    <Card p="$4" bg="$color2" borderWidth={1} borderColor="$borderColor" rounded="$6">
      <Text color="$color" fontSize={15} fontWeight="600">
        {title}
      </Text>
      <Text color="$color11" mt="$1.5" fontSize={13} lineHeight={19}>
        {detail}
      </Text>
      {children}
    </Card>
  )
}

// One face per refusal kind, the same law as lib/api: only the service case
// invites a retry, and its message already says so.
const label: Record<Refusal['kind'], string> = {
  credential: 'Credential rejected',
  credits: 'Out of credits',
  permission: 'Not allowed',
  service: 'Service problem',
}

export function Refuse({ refusal }: { refusal: Refusal }) {
  return <Note title={label[refusal.kind]} detail={refusal.message} />
}
