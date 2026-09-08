import { subscribeToEvents, type UpgradeEvent } from '@/lib/upgrade';
import { withAuth } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: UpgradeEvent) {
        try {
          // Use named SSE events so the client can handle progress and output independently
          const sseType = event.type; // 'progress' or 'output'
          controller.enqueue(encoder.encode(`event: ${sseType}\ndata: ${JSON.stringify(event)}\n\n`));

          // Close stream when upgrade reaches a terminal state
          if (event.type === 'progress' && (event.step === 'complete' || event.step === 'error')) {
            setTimeout(() => {
              unsubscribe?.();
              try {
                controller.close();
              } catch {
                // already closed
              }
            }, 100);
          }
        } catch {
          // Stream may be closed by client
        }
      }

      unsubscribe = subscribeToEvents(send);
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}, 'Failed to establish SSE connection');
