# TODO — RAGLite: Context-aware Chat & Platform Features

This TODO captures a plan to implement structured messages (Option 2) and a discussion/comparison between prioritizing deeper chat features vs. user login/dataset upload flows.

---

## Background

Current project snapshot:
- Zustand-based `chat-store` with streaming support, thinking placeholder and response placeholder.
- `ragApi.streamMessage` supports SSE streaming and token-level routing.
- `chat-store.clean.ts` contains SSE parsing, token routing by `source` or `event` and debug events.
- UI includes a debug panel, dataset selector, chat input, and ChatMessage components.

What isn't yet present:
- Structured `messages[]` payload to backend for multi-turn context.
- Backend support for conversation/session or messages array (unknown; will require backend alignment).
- User login or dataset management UI/APIs (create dataset, upload files, dataset owner identification, etc.).

---

## Option 2: Implement structured `messages[]` (Recommended)

What this includes (frontend):
- Extend `RAGRequest` type in `src/lib/api.ts` to accept `messages?: { role: 'user' | 'assistant' | 'system'; content: string }[]`.
- Add a UI toggle "Include prior messages" (default last 3 turns) in ChatInput or settings.
- In `startStreamingMessage` (chat-store.clean.ts), gather last N messages and pass `messages` along to `ragApi.streamMessage`.
- Add `conversation_id` (session) optional param to `startStreamingMessage` for persistent conversations.
- Keep `ragApi.streamMessage` streaming endpoint used for SSE. Send `messages` as JSON in the request body.

What this includes (backend):
- Accept `messages[]` in the `/rag/stream` endpoint and incorporate them into the prompt + retrieval pipeline.
- Optionally accept a `conversation_id` to persist and use historical context server-side.

Benefits:
- Real multi-turn context and a cleaner system prompt for the model.
- No need for prompt-concatenation hacks.
- Preserves streaming behavior.

Estimated effort:
- Frontend: 4–8 hours to wire UI toggle, types, message payload updates and tests.
- Backend: 2–8 hours depending on existing code; more if persistence or conversation summarization is needed.

Risk:
- Backend may require non-trivial changes; coordinate with backend devs.
- Token limits and cost — add trimming/summary logic.

---

## User Login & Dataset Upload (Auth / Dataset Management)

What this includes:
- Implement user authentication (e.g., NextAuth with GitHub/Google or simple email sign-in).
- Add roles (admin, user) if needed.
- Add endpoints to list/create/delete datasets under user ownership.
- Add UI for dataset creation and file upload, plus progress and validations.

Benefits:
- Persistent, per-user dataset management and privacy.
- Enabling multiple users to use the system securely.
- Needed for dataset-upload features and dataset owner operations.

Estimated effort:
- Frontend: 10–20 hours (auth UI, flows, dataset UI, upload forms).
- Backend: 10–40 hours depending on system architecture (authentication provider, file processing pipeline, storage, dataset indexing).

Risk:
- Security and privacy handling; care for uploads and data pipelines.
- Additional infra (S3, indexing pipeline) if not present.

---

## Prioritization & Recommendations (Debate)

Considerations:
1. User-facing value & flow:
   - Multi-turn chat (Option 2) is the most immediately visible improvement to the chat experience. It provides better follow-ups, clarifications and higher perceived quality.
   - Dataset upload and user accounts are important for sharing and persistent datasets; however, chat improvements deliver the most user-perceived value early on.

2. Dependencies:
   - Dataset upload/login is a prerequisite for user-specific dataset ownership and security.
   - The core RAG runtime doesn't strictly require login; we can accept a default dataset or allow uploads via an admin panel.

3. Implementation Complexity:
   - Option 2 (structured messages) mainly requires API contract changes and minor UI changes—faster to deliver.
   - Auth and dataset pipeline require infra changes, file storage, indexing, and security considerations—more time and complexity.

4. Business Goals & User Stories:
   - If the primary goal is ease-of-use and showcasing capabilities, implement Option 2 first.
   - If the primary goal is to let multiple customers or users upload & manage datasets, prioritize auth + dataset upload.

5. Cost & Resource Planning:
   - Implement Option 2 now, then in parallel start a separate task to design the auth/dataset pipeline with careful security controls.

Recommendation (priority):
- Short term (MVP): Implement Option 2 first — structured messages for multi-turn conversational context.
- Mid term: Add login (NextAuth) and dataset upload with an `admin-only` or `signed-in-only` restriction for dataset creation.
- Long term: Add persistence/summary and user memory, dataset sharing, dataset ACLs and multi-tenant indexing.

Rationale: Option 2 produces the biggest leap in the user experience with minimal backend changes (if backend supports `messages[]`). Authentication and dataset upload are important but require more backend resources and infra; they can be staged in parallel while UI and messaging integration ships quickly for an improved chat experience.

---

## Proposed Step Plan

Phase A (Immediate, days):
- Add `messages[]` support to `src/lib/api.ts` and `startStreamingMessage` in `chat-store.clean.ts`.
- Add a UI toggle to include prior N messages (N configurable, default 3).
- Add a developer toggle to pass `conversation_id` when present.
- Write a README fragment describing the server contract.

Phase B (Parallel):
- Design backend changes to accept `messages[]` and `conversation_id` at `/rag/stream`.
- Minimal session persistence / conversation store if needed.

Phase C (Follow-up, weeks)
- Implement login (NextAuth) and dataset upload UI/UX.
- Implement dataset creation and indexing pipelines.

---

## Next Actions
- (Optional) If you want me to implement Option 2 now, I'll:
  1. Add a toggle and types in the frontend.
  2. Send `messages[]` to `ragApi.streamMessage` from `startStreamingMessage`.
  3. Add an example of the expected backend request payload format to the repo (docs/api/streams.md).

- Otherwise, we can start developing the backend contract for `messages[]` before implementing frontend changes.

Please tell me whether you'd like me to:
- Implement Option 2 now, or
- Prepare a PR with a discussion and contract change only (no code changes yet), or
- Start designing the auth/dataset upload pipeline as next priority.

---

Generated by the assistant to capture plan and prioritization, 2025-11-23
