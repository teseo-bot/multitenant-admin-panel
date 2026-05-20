import { createServer } from 'http';
import { parse } from 'url';
// Using fetch to simulate the stream and client abort

async function runTest() {
  console.log("Simulating SSE connection and abrupt disconnect...");
  
  // We can't easily start the Next.js server if it's not running, 
  // but we can try to hit localhost:3001 if it is.
  try {
    const controller = new AbortController();
    const fetchPromise = fetch('http://localhost:3001/api/threads/events', {
      signal: controller.signal,
      headers: {
        // Need to pass some auth if possible? The middleware blocks if no user.
        // If it blocks with 401, we still validate the middleware works.
      }
    });

    // Abort after 500ms
    setTimeout(() => {
      console.log("Aborting connection...");
      controller.abort();
    }, 500);

    const response = await fetchPromise;
    console.log("Status:", response.status);
    
    if (response.status === 401) {
      console.log("Middleware successfully blocked unauthenticated SSE access.");
    } else {
      const reader = response.body?.getReader();
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        console.log("Received chunk:", new TextDecoder().decode(value));
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log("Fetch successfully aborted.");
    } else {
      console.error("Fetch error:", err);
    }
  }
}

runTest();