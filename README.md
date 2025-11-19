# RAGLite Client

A modern, responsive chat interface for the RAGLite AI assistant, built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Modern Chat Interface**: Clean, intuitive design inspired by leading AI chat applications
- **Real-time Messaging**: Instant message delivery with typing indicators
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Dark Mode Support**: Automatic dark/light mode based on system preferences
- **TypeScript**: Full type safety throughout the application
- **API Integration**: Ready to connect with the RAGLite backend API

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **UI Components**: Material-UI (for future enhancements)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- RAGLite backend server running (default: http://localhost:8000)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd raglite-client
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env.local
```

4. Configure your API endpoint in `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main chat page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ChatMessage.tsx    # Individual message component
│   └── ChatInput.tsx      # Message input component
└── lib/                   # Utilities and services
    ├── api.ts            # API service for RAGLite backend
    └── chat-store.ts     # Zustand store for chat state
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## API Integration

The client communicates with the RAGLite backend through REST API calls. The main endpoint is:

- `POST /api/rag` - Send a query and receive AI-generated response

### Request Format
```typescript
{
  query: string;
  context?: string;
  max_tokens?: number;
}
```

### Response Format
```typescript
{
  response: string;
  sources?: string[];
  metadata?: Record<string, unknown>;
}
```

## Development

### Adding New Features

1. **Components**: Add new components in `src/components/`
2. **API Calls**: Extend the `RAGApiService` in `src/lib/api.ts`
3. **State Management**: Update the chat store in `src/lib/chat-store.ts`
4. **Styling**: Use Tailwind CSS classes or extend the design system

### Environment Variables

- `NEXT_PUBLIC_API_URL`: URL of the RAGLite backend API

## Deployment

### Build for Production

```bash
npm run build
npm run start
```

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is part of the RAGLite ecosystem. See the main RAGLite repository for licensing information.

## Version

Current version: 0.1.0
