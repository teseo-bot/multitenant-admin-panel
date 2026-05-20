import { create } from 'zustand'

export interface AgentStreamState {
  /** Map of message_id -> accumulated text chunk */
  activeStreams: Record<string, string>
  appendChunk: (messageId: string, chunk: string) => void
  clearStream: (messageId: string) => void
}

export const useAgentStreamStore = create<AgentStreamState>((set) => ({
  activeStreams: {},
  appendChunk: (messageId, chunk) =>
    set((state) => ({
      activeStreams: {
        ...state.activeStreams,
        [messageId]: (state.activeStreams[messageId] || '') + chunk,
      },
    })),
  clearStream: (messageId) =>
    set((state) => {
      const { [messageId]: _, ...rest } = state.activeStreams
      return { activeStreams: rest }
    }),
}))
