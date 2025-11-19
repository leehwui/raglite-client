'use client';

import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { useChatStore } from '@/lib/chat-store';
import { ragApi } from '@/lib/api';
import { MessageSquare, Sparkles } from 'lucide-react';

export default function Home() {
  const { messages, isLoading, addMessage, setLoading } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    // Add user message
    addMessage({ content, role: 'user' });

    // Call RAG API
    setLoading(true);
    try {
      const response = await ragApi.sendMessage({ query: content });
      addMessage({
        content: response.response,
        role: 'assistant'
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      addMessage({
        content: 'Sorry, I encountered an error while processing your request. Please try again later.',
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
            Chat history will appear here
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
                  RAGLite Assistant
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Powered by advanced AI and retrieval-augmented generation
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              v0.1.0
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
                  Welcome to RAGLite
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md">
                  Start a conversation with our AI assistant. Ask questions, get help with tasks,
                  or explore the power of retrieval-augmented generation.
                </p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                {isLoading && (
                  <div className="flex justify-start mb-4">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 mr-12">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">RAGLite is thinking...</span>
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
        <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
