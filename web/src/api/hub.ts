import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { API_BASE } from './client'

/**
 * One shared connection to the backend's `/elevation-hub`.
 * The server pushes generation/export progress to clients that joined the matching group,
 * addressed by the connection id we pass as `clientConnectionId` in API calls.
 */
let connection: HubConnection | null = null
let started: Promise<void> | null = null
export const connectionId: Ref<string | null> = ref(null)
/** Group-join methods currently active; replayed after a reconnect, since the server forgets them. */
const joinedGroups = new Map<string, number>()

function rejoinGroups(conn: HubConnection) {
  for (const join of joinedGroups.keys()) conn.invoke(join).catch(() => {})
}

async function refreshConnectionId(conn: HubConnection) {
  try {
    connectionId.value = await conn.invoke<string>('getConnectionId')
  } catch {
    connectionId.value = null
  }
}

function startWithRetry(conn: HubConnection): Promise<void> {
  return conn.start().then(
    () => {
      rejoinGroups(conn)
      return refreshConnectionId(conn)
    },
    () => new Promise<void>((resolve) => setTimeout(() => resolve(startWithRetry(conn)), 5000)),
  )
}

function getConnection(): HubConnection {
  if (connection) return connection
  connection = new HubConnectionBuilder()
    .withUrl(`${API_BASE}/elevation-hub`)
    .withAutomaticReconnect()
    .configureLogging(import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning)
    .build()
  connection.onreconnected(() => {
    if (!connection) return
    rejoinGroups(connection)
    refreshConnectionId(connection)
  })
  connection.onclose(() => {
    connectionId.value = null
    started = connection ? startWithRetry(connection) : null
  })
  started = startWithRetry(connection)
  return connection
}

/** Resolves once connected; never rejects (progress is a nice-to-have, generation still works without it). */
export async function ensureConnected(): Promise<string | null> {
  const conn = getConnection()
  if (conn.state !== HubConnectionState.Connected) {
    await Promise.race([started, new Promise((r) => setTimeout(r, 3000))])
  }
  return connectionId.value
}

const channels = {
  generate: { event: 'ReportGenerateProgress', join: 'JoinGeneratorGroup', leave: 'LeaveGeneratorGroup' },
  export: { event: 'ReportExportProgress', join: 'JoinExportGroup', leave: 'LeaveExportGroup' },
} as const

export interface Progress {
  message: string
  percent: number
}

/** Joins the server-side progress group while the calling component is mounted. */
export function useProgress(kind: keyof typeof channels) {
  const progress = ref<Progress | null>(null)
  const ch = channels[kind]
  const handler = (message: string, percent: number) => {
    progress.value = { message, percent }
  }

  onMounted(async () => {
    const conn = getConnection()
    conn.on(ch.event, handler)
    const count = joinedGroups.get(ch.join) ?? 0
    joinedGroups.set(ch.join, count + 1)
    await ensureConnected()
    if (count === 0 && conn.state === HubConnectionState.Connected) conn.invoke(ch.join).catch(() => {})
  })

  onBeforeUnmount(() => {
    const conn = getConnection()
    conn.off(ch.event, handler)
    const count = (joinedGroups.get(ch.join) ?? 1) - 1
    if (count > 0) {
      joinedGroups.set(ch.join, count)
      return
    }
    joinedGroups.delete(ch.join)
    if (conn.state === HubConnectionState.Connected) conn.invoke(ch.leave).catch(() => {})
  })

  return { progress, reset: () => (progress.value = null) }
}
