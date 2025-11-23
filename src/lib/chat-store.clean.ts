import { create } from 'zustand';
import { ragApi } from './api';

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  performanceMetrics?: {
    timeToFirstToken?: number;
    totalResponseTime?: number;
    tokenCount?: number;
    sources?: number;
    model?: string;
    dataset?: string;
  };
  isThinking?: boolean;
  thinkingCompleted?: boolean;
}

export interface Dataset {
  index_name: string;
  document_count: number;
  embedding_field: string;
  dimensions: number;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  datasets: Dataset[];
  selectedDataset: string | null;
  conversationId: string | null;
  streamingMessageId: string | null;
  streamingThinkingMessageId: string | null;
  streamingStartTime: number | null;
  hasReceivedFirstToken: boolean;
  debugEvents: string[];
  addMessage: (message: Omit<Message, 'id' | 'timestamp'> & { id?: string }) => void;
  setLoading: (loading: boolean) => void;
  setDatasets: (datasets: Dataset[]) => void;
  setSelectedDataset: (dataset: string | null) => void;
  setConversationId: (id: string | null) => void;
  startStreamingMessage: (query: string, dataset?: string) => Promise<void>;
  updateStreamingMessage: (id: string, content: string) => void;
  finishThinkingMessage: (id: string) => void;
  removeMessage: (id: string) => void;
  finishStreamingMessage: (id: string) => void;
  addDebugEvent: (ev: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  datasets: [],
  selectedDataset: null,
  conversationId: null,
  streamingMessageId: null,
  streamingThinkingMessageId: null,
  streamingStartTime: null,
  hasReceivedFirstToken: false,
  debugEvents: [],
  addDebugEvent: (ev: string) => set((s) => ({ debugEvents: [...s.debugEvents, ev].slice(-50) })),
  addMessage: (message) =>
    set((s) => {
      const id = message.id ?? `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
      const msg: Message = { ...message, id, timestamp: new Date() } as Message;
      const ev = `[addMessage] id=${id} role=${message.role} isThinking=${!!message.isThinking}`;
      return { messages: [...s.messages, msg], debugEvents: [...s.debugEvents, ev].slice(-50) } as Partial<ChatState>;
    }),
  setLoading: (loading) => set({ isLoading: loading }),
  setDatasets: (datasets) => set({ datasets }),
  setSelectedDataset: (dataset) => set({ selectedDataset: dataset }),
  setConversationId: (id) => set({ conversationId: id }),
  updateStreamingMessage: (id, content) =>
    set((state) => ({
      // Update streaming message content and performance metrics
      messages: state.messages.map((m) => {
        if (m.id !== id) return m;
        const newContent = m.content + content;
        const isResponse = id === state.streamingMessageId;
        let timeToFirstToken = m.performanceMetrics?.timeToFirstToken;
  const tokenCount = Math.ceil(newContent.length / 4);
        // If this is the response message and we haven't recorded the first token, capture TTFT
        if (isResponse && state.streamingStartTime && !state.hasReceivedFirstToken) {
          timeToFirstToken = Date.now() - state.streamingStartTime;
          // Add debug event for TTFT
          set((s) => ({ debugEvents: [...s.debugEvents, `[ttft] id=${id} ttft=${timeToFirstToken}ms`].slice(-50) }));
        }
        return { ...m, content: newContent, performanceMetrics: { ...m.performanceMetrics, timeToFirstToken, tokenCount } } as Message;
      }),
      // Update received-first-token flag when we see the first token for response
      hasReceivedFirstToken: id === state.streamingMessageId ? true : state.hasReceivedFirstToken,
      debugEvents: [...state.debugEvents, `[update] id=${id} content=${content.slice(0,80)}`].slice(-50),
    } as Partial<ChatState>)),
  finishThinkingMessage: (id) =>
    set((state) => ({ streamingThinkingMessageId: null, messages: state.messages.map((m) => (m.id === id ? { ...m, isThinking: false, thinkingCompleted: true } : m)) } as Partial<ChatState>)),

  // Remove a message by id (e.g., dismiss a thinking message after user closes it)
  removeMessage: (id) => set((state) => ({ messages: state.messages.filter((m) => m.id !== id) } as Partial<ChatState>)),
  finishStreamingMessage: (id) =>
    set((state) => {
      const end = Date.now();
      const total = state.streamingStartTime ? end - state.streamingStartTime : undefined;
      return {
        streamingMessageId: null,
        streamingThinkingMessageId: null,
        streamingStartTime: null,
        hasReceivedFirstToken: false,
        messages: state.messages.map((m) =>
          m.id === id
            ? { ...m, content: m.content.trim(), performanceMetrics: { ...m.performanceMetrics, totalResponseTime: total, dataset: state.selectedDataset ?? 'default' } }
            : m
        ),
      } as Partial<ChatState>;
    }),

  startStreamingMessage: async (query: string, dataset?: string) => {
  const responseMessageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const thinkingMessageId = `think_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  // Only set thinking message on start; don't add response placeholder so the UI won't show an empty final answer while thinking
  set({ streamingMessageId: null, streamingThinkingMessageId: thinkingMessageId, streamingStartTime: Date.now(), hasReceivedFirstToken: false });
  set((s) => ({ debugEvents: [...s.debugEvents, `[stream-start] response=${responseMessageId} thinking=${thinkingMessageId} dataset=${dataset ?? 'default'}`].slice(-50) }));
  get().addMessage({ id: thinkingMessageId, role: 'assistant', content: '', isThinking: true });

  // Helper: create a response message lazily only when we receive response tokens
    const ensureResponseMessage = () => {
      const exists = get().messages.some((m) => m.id === responseMessageId);
      if (!exists) {
        get().addMessage({ id: responseMessageId, role: 'assistant', content: '' });
        set((s) => ({ debugEvents: [...s.debugEvents, `[create-response] id=${responseMessageId}`].slice(-50) }));
        set({ streamingMessageId: responseMessageId });
      }
    };

  try {
  // Build messages array to send: include current user query as a single message
  const messagesToSend = [{ role: 'user' as const, content: query }];
  const stream = await ragApi.streamMessage({ query, index_name: dataset, top_k: 3, messages: messagesToSend, conversation_id: get().conversationId ?? null, include_thinking: false });
      const reader = stream.getReader();
      const decoder = new TextDecoder();
  let buf = '';
  // Accumulate event fragments across chunks. We'll split full events by '\n\n' and keep partial last event in the buffer
  // Use -1 so seq=0 tokens are accepted; allow >= to handle non-incrementing seqs from some backends
  let lastSeqThinking = -1;
  let lastSeqResponse = -1;

      let chunkCount = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        chunkCount += 1;
        if (chunkCount <= 10) set((s) => ({ debugEvents: [...s.debugEvents, `[raw-chunk-${chunkCount}] len=${chunk.length} snippet=${chunk.slice(0,120)}`].slice(-50) }));
        buf += chunk;

  // Split buffer into event blocks split by a blank line. Keep last part as the remaining buffer.
  const events = buf.split(/\n\n/);
        // Keep last partial event (possibly incomplete) as residual buffer
        buf = events[events.length - 1] || '';

        // Process all complete events (everything except last)
        for (let i = 0; i < events.length - 1; i++) {
          const evt = events[i];
          set((s) => ({ debugEvents: [...s.debugEvents, `[evt] rawEventLen=${evt.length} preview=${evt.slice(0,120)}`].slice(-50) }));
          // Parse SSE headers and data lines
          const lines = evt.split('\n').map((l) => l.trim()).filter(Boolean);
          let evtType: string | undefined;
          const dataLines: string[] = [];
          for (const l of lines) {
            if (l.startsWith('event:')) {
              evtType = l.slice(6).trim();
            } else if (l.startsWith('data:')) {
              dataLines.push(l.slice(5).trim());
            } else if (l.includes('data:')) {
              const idx = l.indexOf('data:');
              const evtPart = l.slice(0, idx).replace('event:', '').trim();
              if (evtPart) evtType = evtPart;
              dataLines.push(l.slice(idx + 5).trim());
            }
          }
          const combinedData = dataLines.join('\n');
          set((s) => ({ debugEvents: [...s.debugEvents, `[evt-data] evtType=${evtType || 'none'} len=${combinedData.length} preview=${combinedData.slice(0,80)}`].slice(-50) }));

          // If there's no data, skip
          if (!combinedData) continue;

          // Look for JSON tokens first; this is the recommended format.
          const jsons = combinedData.match(/\{[^}]*\}/g) || [];
          if (jsons.length > 0) {
            for (const json of jsons) {
        try {
          type TokenEvent = { token?: string; source?: string; seq?: number };
          type SearchCompleteEvent = { sources?: number; conversation_id?: string };
          const obj = JSON.parse(json) as TokenEvent | SearchCompleteEvent;
                if ('token' in obj && !!obj.token) {
                  set((s) => ({ debugEvents: [...s.debugEvents, `[json-token] source=${obj.source || evtType || 'response'} seq=${obj.seq || 0} token=${String(obj.token).slice(0,80)}`].slice(-50) }));
                  const token = String(obj.token || '');
                  const source = String(obj.source || evtType || 'response');
                  const seq = Number(obj.seq || 0);
                  if (source === 'thinking') {
                    if (seq >= lastSeqThinking) {
                      lastSeqThinking = seq;
                      set((s) => ({ debugEvents: [...s.debugEvents, `[seq-check] thinking seq>=last? ${seq}>=${lastSeqThinking}`].slice(-50) }));
                      get().updateStreamingMessage(thinkingMessageId, token);
                      set((s) => ({ debugEvents: [...s.debugEvents, `[token->thinking] seq=${seq} token=${token.slice(0,40)}`].slice(-50) }));
                    }
                  } else {
                    if (seq >= lastSeqResponse) {
                        lastSeqResponse = seq;
                        set((s) => ({ debugEvents: [...s.debugEvents, `[seq-check] response seq>=last? ${seq}>=${lastSeqResponse}`].slice(-50) }));
                        ensureResponseMessage();
                        get().updateStreamingMessage(responseMessageId, token);
                      set((s) => ({ debugEvents: [...s.debugEvents, `[token->response] seq=${seq} token=${token.slice(0,40)}`].slice(-50) }));
                      if (!get().hasReceivedFirstToken) set({ hasReceivedFirstToken: true });
                    }
                  }
                } else if ('sources' in obj || 'conversation_id' in obj) {
                  // search_complete or related metadata, attach sources to the response message
                  const sources = Number((obj as { sources?: number }).sources || 0);
                  set((cur) => ({ messages: cur.messages.map((m) => (m.id === responseMessageId ? { ...m, performanceMetrics: { ...m.performanceMetrics, sources } } : m)) }));
                  set((s) => ({ debugEvents: [...s.debugEvents, `[search_complete] sources=${sources}`].slice(-50) }));
                  if ((obj as { conversation_id?: string }).conversation_id) {
                    const convId = String((obj as { conversation_id?: string }).conversation_id);
                    set(() => ({ conversationId: convId }));
                    set((s) => ({ debugEvents: [...s.debugEvents, `[conversation-created] id=${convId}`].slice(-50) }));
                  }
                }
              } catch {
                // ignore
              }
            }
            continue; // processed json tokens, skip fallback
          }

          // Fallback: route plain text based on event type (evtType) when available
          if (evtType === 'thinking') {
            get().updateStreamingMessage(thinkingMessageId, combinedData);
            set((s) => ({ debugEvents: [...s.debugEvents, `[text->thinking] ${combinedData.slice(0,60)}`].slice(-50) }));
            } else {
            ensureResponseMessage();
            get().updateStreamingMessage(responseMessageId, combinedData);
            set((s) => ({ debugEvents: [...s.debugEvents, `[text->response] ${combinedData.slice(0,60)}`].slice(-50) }));
            if (!get().hasReceivedFirstToken) set({ hasReceivedFirstToken: true });
          }
        }

        // Also process any completed newline-terminated data lines (lines ending with '\n' in buffer)
        const lines = buf.split('\n');
        // All but the last item are completed lines
        const completeLines = lines.slice(0, -1);
        buf = lines[lines.length - 1] || '';
        for (const line of completeLines) {
          const l = line.trim();
          if (!l) continue;
          if (l.startsWith('event:')) continue;
          let dataPart = l;
          if (l.startsWith('data:')) dataPart = l.slice(5).trim();
          // JSON token - parse
          if (dataPart.startsWith('{')) {
            try {
              const o = JSON.parse(dataPart) as { token?: string; source?: string; seq?: number };
              if (o.token) {
                const token = String(o.token);
                const source = String(o.source || 'response');
                const seq = Number(o.seq || 0);
                if (source === 'thinking') {
                  if (seq > lastSeqThinking) {
                    lastSeqThinking = seq;
                    get().updateStreamingMessage(thinkingMessageId, token);
                    set((s) => ({ debugEvents: [...s.debugEvents, `[line-json->thinking] seq=${seq} token=${token.slice(0,80)}`].slice(-50) }));
                  }
                } else {
                  if (seq > lastSeqResponse) {
                    lastSeqResponse = seq;
                    ensureResponseMessage();
                    get().updateStreamingMessage(responseMessageId, token);
                    set((s) => ({ debugEvents: [...s.debugEvents, `[line-json->response] seq=${seq} token=${token.slice(0,80)}`].slice(-50) }));
                    if (!get().hasReceivedFirstToken) set({ hasReceivedFirstToken: true });
                  }
                }
              }
            } catch {}
            continue;
          }
          // Not a JSON object; treat as plain text token and route by default to response unless earlier 'evtType' says thinking
          ensureResponseMessage();
          get().updateStreamingMessage(responseMessageId, dataPart);
          set((s) => ({ debugEvents: [...s.debugEvents, `[line->response] ${dataPart.slice(0,80)}`].slice(-50) }));
          if (!get().hasReceivedFirstToken) set({ hasReceivedFirstToken: true });
        }

        // Also keep the legacy JSON discovery which attempted to parse JSON anywhere in buffer (only for direct chunks)
        const quickJsons = buf.match(/\{[^}]*\}/g) || [];
        for (const json of quickJsons) {
      try {
        const obj = JSON.parse(json) as { token?: string; source?: string; seq?: number };
            if (obj.token) {
              const token = String(obj.token || '');
              const source = String(obj.source || 'response');
              const seq = Number(obj.seq || 0);
              if (source === 'thinking') {
                if (seq > lastSeqThinking) {
                  lastSeqThinking = seq;
                  get().updateStreamingMessage(thinkingMessageId, token);
                }
              } else {
                if (seq > lastSeqResponse) {
                          lastSeqResponse = seq;
                          ensureResponseMessage();
                          get().updateStreamingMessage(responseMessageId, token);
                }
              }
            }
              } catch {
                // ignore
              }
        }

        // The fallback above already handled plain-text (non-json) events; this block is kept minimal to avoid duplicates

        if (buf.length > 10000) buf = buf.slice(-10000);
      }

  const rest = buf.match(/\{[^}]*\}/g) || [];
  for (const j of rest) {
        try {
          const o = JSON.parse(j) as { token?: string };
          if (o.token) {
            ensureResponseMessage();
            get().updateStreamingMessage(responseMessageId, String(o.token));
          }
        } catch {}
      }
      reader.releaseLock();
      get().finishStreamingMessage(responseMessageId);
      get().finishThinkingMessage(thinkingMessageId);
    } catch (err) {
      console.error('Streaming error', err);
      get().updateStreamingMessage(responseMessageId, `Error: ${err instanceof Error ? err.message : 'Unknown'}`);
      get().finishStreamingMessage(responseMessageId);
      get().finishThinkingMessage(thinkingMessageId);
    }
  },

  // Load full conversation messages from backend and replace current message list
  loadConversation: async (convId: string, last_n = 50) => {
    try {
      const data = await ragApi.getConversation(convId, last_n);
      // data expected: { meta, messages: [{ role, content, timestamp, id }] }
      if (data?.messages && Array.isArray(data.messages)) {
  type BackendMessage = { id?: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp?: string | number; performanceMetrics?: Partial<Message['performanceMetrics']> };
        const msgs = data.messages.map((m: BackendMessage) => ({ id: m.id ?? `${Date.now()}-${Math.random().toString(36).slice(2,6)}`, role: m.role as 'user' | 'assistant', content: m.content, timestamp: new Date(m.timestamp || Date.now()), performanceMetrics: m.performanceMetrics } as Message));
        set(() => ({ messages: msgs, conversationId: convId } as Partial<ChatState>));
      } else {
        set(() => ({ conversationId: convId } as Partial<ChatState>));
      }
      set((s) => ({ debugEvents: [...s.debugEvents, `[loadConversation] id=${convId} loaded=${data?.messages?.length ?? 0}`].slice(-50) }));
    } catch (error) {
      set((s) => ({ debugEvents: [...s.debugEvents, `[loadConversation:error] ${String(error)}`].slice(-50) }));
    }
  },
}));
