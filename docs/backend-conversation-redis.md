Backend Implementation Guide: Redis-based Conversation Support (conversation_id)

Overview
--------
This document provides a comprehensive, step-by-step plan for backend changes to support a conversation/session-based design using Redis as the ephemeral store (24-hour TTL). The goal is to accept conversation_id and messages[] from the front-end (Option 2) and support SSE streaming for RAG responses with session continuity and reconnection.

This guide is ready to be handed to a backend engineer for implementation.

Assumptions
-----------
- Existing streaming API endpoints are present (e.g., POST /rag/stream) and use SSE to stream tokens back to the client.
- Redis is available (REDIS_URL) and accessible from backend.
- No auth system is currently required; user association is out of scope for now.

High-level requirements
-----------------------
1. Accept `conversation_id` and optional `messages[]` in `/rag/stream`.
2. If a `conversation_id` is present, persist session state in Redis with a 24-hour TTL that refreshes on each write.
3. Provide a lightweight endpoint to create new conversations (POST /conversations) returning `conversation_id`.
4. Manage message lifecycle (pending/inflight/complete) while streaming.
5. On message or conversation finalization, optionally persist or archive the conversation (optional at this stage) and mark it completed. Redis must not retain forever.
6. Implement a background worker to purge stale conversations (older than TTL) and optionally archive them where needed.
7. Keep SSE behavior intact and add minimal API contract changes to support `messages[]` and `conversation_id`.

Redis key design
----------------
- raglite:conversation:{id}:meta (HASH) — prefix with project identifier (see `REDIS_KEY_PREFIX`).
  - Fields: user_id (optional), created_at, updated_at, status (active/completed), ttl policy information
- raglite:conversation:{id}:messages (LIST)
  - Each item is a stringified JSON message: { id, role, content, timestamp, isThinking, thinkingCompleted, performanceMetrics }
  - Use RPUSH for new messages; LTRIM for bounding message length when needed.
- raglite:conversation:{id}:inflight:{messageId} (STRING or HASH)
  - Temporary storage for incomplete message content (streaming tokens), e.g., string of accumulated tokens
- raglite:conversation:lastUpdates (ZSET)
  - Sorted set by last_update_at timestamp. Allows scanning for stale sessions across conversations.

Redis TTL policy
-----------------
- Use a sliding TTL of 24 hours (configurable via environment variable CONVO_TTL_SECONDS, default 86400 seconds).
- On each write (append message, append token, update metadata), refresh EXPIRE on the associated keys to the TTL.
- If conversation is marked completed and you opt to archive, set short TTL (or delete keys after archive).

API Contract (Frontend -> Backend)
----------------------------------
1. POST /conversations
- Request: { name?: string }
- Response: { conversation_id: string, created_at }

Note: The front-end 'Start conversation' UI is deferred for now. Please make sure the `POST /conversations` endpoint is available so clients (or a later UI) can create a conversation via the API (without requiring a UI change in this phase).

2. POST /rag/stream (existing streaming endpoint) — new optional fields
- Request body (JSON):
{
  query: string,
  index_name?: string,
  top_k?: number,
  stream?: boolean,
  conversation_id?: string,
  messages?: [ { role: 'user'|'assistant'|'system', content: string, id?: string } ],
}
- Behavior:
  - If `conversation_id` is provided and not found in Redis: create meta record and messages list.
  - If `messages[]` is present, append them to the messages list (or create one using RPUSH) and refresh TTL.
  - If `messages[]` absent but `conversation_id` present, the server should fetch the last N messages from Redis to form prompt context.
  - Streaming behavior: respond via SSE as tokens arrive (unchanged). Include metadata in first/last events if needed (e.g., conversation_id returned when the user didn't provide one).

3. (Optional) GET /conversations/{id} — fetch meta (last N messages)
- Returns JSON meta and last messages list for UI.

4. (Optional) POST /conversations/{id}/end or DELETE — end or delete conversation
- Optional endpoint to mark the session completed and flush to archive or delete keys.

Server streaming semantics: token routing and message creation
-----------------------------------------------------------
- On stream start:
  1. If the backend receives messages[] from the client, append them to Redis (RPUSH) and refresh TTL.
  2. Create a new message record for the assistant `isThinking=true` and push to messages list in Redis. Keep message `id` returned to the client.
  3. Set `conversation:{id}:inflight:{messageId}` as the inflight content buffer (empty string or empty JSON). EXPIRE the keys.
- On receiving tokens from the model:
  1. Append tokens to the inflight buffer in Redis: append the token to `conversation:{id}:inflight:{messageId}` (use APPEND or HSET for JSON if using RedisJSON).
  2. Keep EXPIRE refreshed.
- On message finalize (end token / final event):
  1. Flush the inflight buffer into the final message in the list (LSET or replace last item), set `isThinking=false` and `thinkingCompleted=true`.
  2. Optionally persist to DB if required.
  3. Keep the conversation in Redis (status active or completed) until TTL expiration; if you want it removed earlier, delete keys.

Token consistency and reconnection
---------------------------------
- Use message-level IDs and state flags to manage reconnections:
  - If client reconnects with `conversation_id`, read last message state from Redis to determine if an inflight message exists.
  - If inflight message exists (inflight buffer or last message marked pending), either resume or start a new message depending on desired UX.
- Use atomic commands for appending tokens: RPUSH/APPEND or Redis transactions (WATCH/MULTI/EXEC) if needed.

Archival and purge flow (recommended)
-------------------------------------
- Option 1 (auto-expire): Keep only Redis TTL for the lifetime of transient conversation data (24h). No DB persistence required initially.
- Option 2 (archive on end / background worker): When a conversation ends (explicit user action) or a background worker finds conversations older than TTL:
  - Fetch messages (LRANGE) from Redis.
  - Persist messages to a durable store (Postgres, S3 or other) or write to object storage.
  - Delete Redis keys (meta and messages). Also remove ZSET entries in conversation:lastUpdates.

Background worker design (simple)
---------------------------------
- Job: scan `conversation:lastUpdates` for items where last_update < (now - TTL). For each conversation_id:
  1. Optionally persist the messages and meta if needed.
  2. Delete keys: `conversation:{id}:messages`, `conversation:{id}:meta`, `conversation:{id}:inflight:*`.
  3. ZREM from `conversation:lastUpdates`.
- Frequency: run every 5–15 minutes depending on scale.

Data size limiting
------------------
- To keep Redis memory bounded, consider these limits:
  - LTRIM conversation:{id}:messages to keep last N messages (N configurable, e.g., 100).
  - Also consider per-message content length limiting (truncate long messages or store attachments elsewhere).

Important environment variables (config)
----------------------------------------
- REDIS_URL — connection string for Redis
- CONVO_TTL_SECONDS — default TTL for conversation keys (default 86400)
- CONVO_MAX_MESSAGES — maximum messages to keep in Redis per conversation (default 100)
- CONVO_ARCHIVE_ENABLED — toggle if archiving is desired (false by default during MVP)
 - REDIS_KEY_PREFIX — prefix to use for Redis keys to avoid conflicts with other projects (default: 'raglite')

Security & privacy considerations
--------------------------------
- Without auth, anyone with a conversation_id can access the conversation. Do not store sensitive PII unless you have a privacy policy and secure auth.
- If you later add authentication, tie conversation meta to user_id and verify on read/write operations that the user owns the conversation.
- Optionally provide a delete/export endpoint for users to remove their conversations.

Sample Node.js (Express) implementation snippets
-----------------------------------------------
// Server skeleton and Redis client (ioredis) usage

```js
const express = require('express');
const bodyParser = require('body-parser');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

const app = express();
const redis = new Redis(process.env.REDIS_URL);
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'raglite';
app.use(bodyParser.json());

// POST /conversations
app.post('/conversations', async (req, res) => {
  const convId = uuidv4();
  const now = Date.now();
  const ttl = parseInt(process.env.CONVO_TTL_SECONDS || '86400');
  await redis.hset(`${REDIS_KEY_PREFIX}:conversation:${convId}:meta`, 'created_at', now, 'last_update_at', now, 'status', 'active');
  await redis.expire(`${REDIS_KEY_PREFIX}:conversation:${convId}:meta`, ttl);
  res.json({ conversation_id: convId, created_at: now });
});

app.post('/rag/stream', async (req, res) => {
  // Validate request
  const { query, index_name, top_k, stream, conversation_id, messages } = req.body;
  const convId = conversation_id || uuidv4();
  const now = Date.now();
  const ttl = parseInt(process.env.CONVO_TTL_SECONDS || '86400');

  // If messages provided, persist them to Redis
  if (messages && messages.length > 0) {
    const rmsgs = messages.map(m => JSON.stringify({ ...m, timestamp: Date.now() }));
  await redis.rpush(`${REDIS_KEY_PREFIX}:conversation:${convId}:messages`, ...rmsgs);
  await redis.hset(`${REDIS_KEY_PREFIX}:conversation:${convId}:meta`, 'last_update_at', now);
  await redis.expire(`${REDIS_KEY_PREFIX}:conversation:${convId}:messages`, ttl);
  }

  // Create an inflight assistant message
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const assistantMsg = { id: messageId, role: 'assistant', content: '', timestamp: Date.now(), isThinking: true };
  await redis.rpush(`${REDIS_KEY_PREFIX}:conversation:${convId}:messages`, JSON.stringify(assistantMsg));
  await redis.expire(`${REDIS_KEY_PREFIX}:conversation:${convId}:messages`, ttl);

  // TODO: wire the model streaming and append tokens to inflight buffer in Redis and push to SSE

  res.json({ conversation_id: convId });
});
```

Note: The above example focuses on flow and Redis usage. You’ll need to integrate the actual model call and SSE streaming logic (existing in the project) to this flow.

Testing and QA
--------------
- Unit tests:
  1. Test POST /conversations returns a new conversation_id and Redis key is created
  2. Test POST /rag/stream with messages[] persists messages to Redis correctly
  3. Test streaming append: inflight tokens appended to inflight key
  4. Test finalize: final message content replaces inflight and is marked complete
- Integration tests:
  1. Full lifecycle: start conv -> stream tokens -> finalize -> fetch messages
  2. Reconnect flow: simulate client reconnect with convId -> ensure the inflight message can be resumed or detected
- Load tests:
  - Evaluate Redis memory usage with many concurrent sessions; test LTRIM and TTL behavior at scale.

Acceptance Criteria
-------------------
- Backend accepts `conversation_id` and `messages[]` in /rag/stream and returns the `conversation_id` when necessary
- Streaming tokens are appended to Redis inflight buffer and flushed into final message
- Redis TTL is set to 24 hours and refreshed on message activity
- Background worker can purge and archive stale conversations
- Redis usage bounded (LTRIM used with configurable limit)

Deployment & Rollout
--------------------
- Feature flags (ENV) to enable conversation_id and Redis flow: `CONVO_REDIS_ENABLED` true/false
- Monitor memory and ensure Redis cluster scaled properly for expected concurrent conversations
- Roll out in stages: dev -> staging -> production with monitoring for errors and performance

Follow-ups for later phases
---------------------------
- Add user auth & ownership: tie conversation.user_id (requires changes to the UI and API) and ensure security.
- Archive persisted conversations to Postgres or S3 and implement search/indexing if needed.
- Add vector store memory for long-term retrieval.

If you'd like, I can also create:
- A small sample Express + Redis project scaffold (server + tests) for you to run locally.
- A JSON schema file for the updated API contract we can use to generate OpenAPI docs.

Acknowledgments
---------------
- This design is purposely conservative for an early-stage app and avoids premature DB/infra changes while enabling full multi-turn conversation support.



