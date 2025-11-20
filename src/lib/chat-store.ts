import { create } from 'zustand';
import { ragApi } from './api';

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  // Performance metrics for assistant messages
  performanceMetrics?: {
    timeToFirstToken?: number; // milliseconds
    totalResponseTime?: number; // milliseconds
    tokenCount?: number;
    model?: string;
    dataset?: string;
  };
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
  streamingMessageId: string | null;
  streamingStartTime: number | null;
  hasReceivedFirstToken: boolean;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'> & { id?: string }) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
  setDatasets: (datasets: Dataset[]) => void;
  setSelectedDataset: (datasetName: string | null) => void;
  startStreamingMessage: (query: string, dataset?: string) => Promise<void>;
  updateStreamingMessage: (id: string, content: string) => void;
  finishStreamingMessage: (id: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  datasets: [],
  selectedDataset: null,
  streamingMessageId: null,
  streamingStartTime: null,
  hasReceivedFirstToken: false,
  addMessage: (message: Omit<Message, 'id' | 'timestamp'> & { id?: string }) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: message.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        },
      ],
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  clearMessages: () => set({ messages: [] }),
  setDatasets: (datasets) => set({ datasets }),
  setSelectedDataset: (datasetName) => set({ selectedDataset: datasetName }),
  startStreamingMessage: async (query: string, dataset?: string) => {
    // Generate unique ID for the new message
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize performance tracking
    const startTime = Date.now();
    set({ streamingStartTime: startTime, hasReceivedFirstToken: false });
    
    // Add initial message with empty content
    get().addMessage({
      id: messageId,
      role: 'assistant',
      content: '',
    });

    try {
      // Get streaming response from API
      const stream = await ragApi.streamMessage({
        query,
        index_name: dataset,
        top_k: 3,
      });

      // Process the stream
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // Finish the message
            get().finishStreamingMessage(messageId);
            break;
          }

          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6); // Remove 'data: ' prefix
              
              // Check if this is the end marker
              if (dataStr === '[DONE]') {
                // Finish the message
                get().finishStreamingMessage(messageId);
                return;
              }
              
              // Try to parse as JSON for token data
              try {
                const data = JSON.parse(dataStr);

                // If the server sends a token chunk, append it
                if (data.token) {
                  get().updateStreamingMessage(messageId, data.token);
                }

                // If the server sends model info or metadata, store it in the message metrics
                // Supported shapes: { model: 'name' } or { metadata: { model: 'name' } }
                const modelName = data.model || data.metadata?.model || data.meta?.model;
                if (modelName) {
                  // Attach model to the in-flight message performance metrics
                  set((state) => ({
                    messages: state.messages.map((msg) =>
                      msg.id === messageId
                        ? {
                            ...msg,
                            performanceMetrics: {
                              ...msg.performanceMetrics,
                              model: modelName,
                            },
                          }
                        : msg
                    ),
                  }));
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data as JSON:', dataStr, parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Streaming error:', error);
      
      // Update message with error
      get().updateStreamingMessage(messageId, `Error: ${error instanceof Error ? error.message : 'Unknown streaming error'}`);
      get().finishStreamingMessage(messageId);
    }
  },
  updateStreamingMessage: (id, content) =>
    set((state) => {
      const message = state.messages.find((msg) => msg.id === id);
      if (!message) return state;

      const currentTime = Date.now();
      const isFirstToken = !state.hasReceivedFirstToken;
      const timeToFirstToken = isFirstToken && state.streamingStartTime 
        ? currentTime - state.streamingStartTime 
        : message.performanceMetrics?.timeToFirstToken;
      
      // Estimate token count (rough approximation: ~4 characters per token)
      const newTokenCount = Math.ceil((message.content + content).length / 4);
      
      return {
        hasReceivedFirstToken: true,
        messages: state.messages.map((msg) =>
          msg.id === id ? { 
            ...msg, 
            content: msg.content + content,
            performanceMetrics: {
              ...msg.performanceMetrics,
              timeToFirstToken,
              tokenCount: newTokenCount,
            }
          } : msg
        ),
      };
    }),
  finishStreamingMessage: (id) =>
    set((state) => {
      const endTime = Date.now();
      const totalResponseTime = state.streamingStartTime ? endTime - state.streamingStartTime : undefined;
      
      return {
        streamingMessageId: null,
        streamingStartTime: null,
        hasReceivedFirstToken: false,
        messages: state.messages.map((msg) =>
          msg.id === id ? { 
            ...msg,
            content: msg.content.trim(),
            performanceMetrics: {
              ...msg.performanceMetrics,
              totalResponseTime,
              // Preserve any model reported during streaming; otherwise leave undefined
              model: msg.performanceMetrics?.model,
              dataset: state.selectedDataset || 'default',
            }
          } : msg
        ),
      };
    }),
}));