import { Chat } from '@/components/chat/chat'

// Deep link target hanzo://chat/private. Same surface as the tab, flagged
// ephemeral: nothing persisted, cleared on unmount — one chat
// implementation, two mounts.
export default function Private() {
  return <Chat ephemeral />
}
