# Job Worker

This worker polls the `jobs` table and processes pending jobs.

## Running the Worker

```bash
# From root
npm run backend:worker

# Or from backend directory
npm run worker
```

## How It Works

1. **Polling**: Checks for pending jobs every 5 seconds
2. **Claiming**: Atomically updates job status to 'running' to prevent double-processing
3. **Processing**: Executes the appropriate processor based on job type
4. **Completion**: Updates job to 'completed' or 'failed' with results

## Job Types

- `analysis`: Simulates analysis work
- `generation`: Simulates content generation  
- `processing`: Generic processing task

## Creating Test Jobs

You can create test jobs directly in the database or via Prisma Studio:

```typescript
// Example: Create a test job
await prisma.job.create({
  data: {
    type: 'analysis',
    status: 'pending',
    payload: { message: 'Test job' },
  },
})
```

Or use the test script:

```bash
npx ts-node src/create-test-job.ts
```

## Job States

- `pending`: Job is waiting to be processed
- `running`: Job is currently being processed
- `completed`: Job finished successfully
- `failed`: Job failed after max retry attempts

## Retry Logic

- Jobs are retried up to `maxAttempts` (default: 3)
- Failed jobs return to `pending` status until max attempts reached
- After max attempts, jobs are marked as `failed` permanently

## Graceful Shutdown

The worker handles SIGINT (Ctrl+C) and SIGTERM signals gracefully, allowing current jobs to complete before shutting down.
