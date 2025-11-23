 'use client';
import React, { useState } from 'react';
import { Message, useChatStore } from '@/lib/chat-store.clean';
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isThinkingActive = !!message.isThinking;
  const isThinkingCompleted = !!message.thinkingCompleted;
  const isThinkingAny = isThinkingActive || isThinkingCompleted;
  const [showThinking, setShowThinking] = useState(false);
  // Do not auto-open/auto-close the thinking bubble; the user controls visibility with the chevron.
  const t = useTranslations();
  const hasActiveThinking = useChatStore((s) => s.messages.some((m) => m.isThinking));

  // If there's an active thinking message, hide empty response placeholders
  if (!isThinkingAny && message.role === 'assistant' && !message.content.trim() && hasActiveThinking) return null;

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatMetrics = (metrics: Message['performanceMetrics']) => {
    if (!metrics) return null;
    const parts = [] as string[];
    if (metrics.timeToFirstToken) parts.push(`TTFT: ${formatTime(metrics.timeToFirstToken)}`);
    if (metrics.totalResponseTime) parts.push(`Total: ${formatTime(metrics.totalResponseTime)}`);
    if (metrics.tokenCount) parts.push(`${metrics.tokenCount} tokens`);
    if (metrics.sources !== undefined) parts.push(`${metrics.sources} sources`);
    if (metrics.model) parts.push(metrics.model);
    if (metrics.dataset) parts.push(metrics.dataset);
    return parts.join(' • ');
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white ml-12'
            : 'bg-gray-100 text-gray-900 mr-12 dark:bg-gray-800 dark:text-gray-100'
        }`}
      >
        {typeof window !== 'undefined' && (() => {
          console.log('[ChatMessage] render', { id: message.id, isThinking: message.isThinking, content: message.content.slice(0, 50) });
          return null;
        })()}
        <div className="whitespace-pre-wrap">
          {isThinkingAny ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {isThinkingActive ? (
                    <>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </>
                  ) : (
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
                <div className="text-xs text-gray-500 ml-1">{isThinkingActive ? t('chat.thinking') : t('chat.thoughts')}</div>
                <div className="flex items-center gap-1">
                  <button
                    aria-expanded={showThinking}
                    aria-label={showThinking ? 'Hide thinking text' : 'Show thinking text'}
                    onClick={() => setShowThinking((s) => !s)}
                    className="text-xs text-gray-500 ml-1 p-1 hover:bg-gray-200 rounded"
                  >
                    {showThinking ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              {showThinking && (
                <div className="mt-2 px-2 py-2 bg-gray-50 rounded text-sm italic text-gray-600 dark:bg-gray-800 dark:text-gray-300 whitespace-pre-wrap border-l-2 border-gray-200 dark:border-gray-700">
                  {message.content || <span className="italic text-gray-500">(thinking...)</span>}
                </div>
              )}
            </>
          ) : (
            message.content
          )}
        </div>
        {/* Hide timestamp for thinking items */}
        {!isThinkingAny && (
          <div className={`text-xs mt-2 opacity-70 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
  {!isUser && !isThinkingAny && message.performanceMetrics && (
          <div className="text-xs mt-1 opacity-60 text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-1">
            {formatMetrics(message.performanceMetrics)}
          </div>
        )}
      </div>
    </div>
  );
}
 