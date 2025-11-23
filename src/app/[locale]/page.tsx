'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useChatStore } from '@/lib/chat-store.clean';
import { ragApi } from '@/lib/api';
import { MessageSquare, Sparkles } from 'lucide-react';

export default function Home() {
  const t = useTranslations();
  const { messages, isLoading, datasets, selectedDataset, addMessage, setLoading, setDatasets, setSelectedDataset, startStreamingMessage, debugEvents } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    console.log('[page] messages updated', { count: messages.length });
  }, [messages.length]);

  useEffect(() => {
    // Fetch available datasets on component mount
    const fetchDatasets = async () => {
      try {
        const datasetsResponse = await ragApi.listDatasets();
        const availableDatasets = datasetsResponse.datasets || [];
        setDatasets(availableDatasets);
        // Auto-select the first dataset if none is selected
        if (availableDatasets.length > 0 && !selectedDataset) {
          setSelectedDataset(availableDatasets[0].index_name);
        }
      } catch (error) {
        console.error('Failed to fetch datasets:', error);
      }
    };

    fetchDatasets();
  }, [setDatasets, setSelectedDataset, selectedDataset]);

  const handleSendMessage = async (content: string) => {
    // Add user message
    addMessage({ content, role: 'user' });

    // Check if we have a selected dataset
    if (!selectedDataset) {
      addMessage({
        content: t('chat.noDataset'),
        role: 'assistant'
      });
      return;
    }

    // Start streaming response
    setLoading(true);
    try {
      await startStreamingMessage(content, selectedDataset);
    } catch (error) {
      console.error('Failed to start streaming:', error);
      addMessage({
        content: `${t('chat.error')}: ${error instanceof Error ? error.message : 'Unknown error'}. Please make sure the RAGLite backend is running.`,
        role: 'assistant'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - can be expanded later for chat history */}
      <div className="hidden md:flex w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">RAGLite</h1>
          </div>
        </div>
        <div className="flex-1 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('navigation.home')}
          </p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <Sparkles className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('chat.title')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('chat.poweredBy')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <div className="text-sm text-gray-500 dark:text-gray-400">
                v0.1.1
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-full p-6 mb-6">
                  <MessageSquare className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {t('chat.title')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md">
                  {t('chat.welcomeMessage')}
                </p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                {isLoading && !messages.some((m) => m.isThinking) && (
                  <div className="flex justify-start mb-4">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 mr-12">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{t('chat.thinking')}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Input */}
        <ChatInput
          onSendMessage={handleSendMessage}
          datasets={datasets}
          selectedDataset={selectedDataset}
          onDatasetChange={setSelectedDataset}
          disabled={isLoading}
        />
        {/* Debug Panel (visible in dev only) */}
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-w-xs text-xs text-gray-500 dark:text-gray-300 shadow-lg z-50">
          <div className="font-semibold mb-2">Debug</div>
          <div className="mb-1">Messages: {messages.length}</div>
          <div className="mb-1">Message contents:</div>
          <div className="max-h-28 overflow-y-auto text-xs leading-tight mb-2">
            {messages.map((m) => (
              <div key={m.id} className="mb-1">{m.id} {' '} {m.role} {' '} {m.isThinking ? '(thinking)' : ''} {' '} {m.content.slice(0,80)}</div>
            ))}
          </div>
          <div className="mb-1">Selected dataset: {selectedDataset || 'none'}</div>
          <div className="max-h-40 overflow-y-auto text-xs leading-tight">
            {debugEvents.slice(-10).map((ev, idx) => (
              <div key={idx} className="mb-1">{ev}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
