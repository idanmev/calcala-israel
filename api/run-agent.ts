import { runAgent } from '../agent/index';

export default async function handler(req: any, res: any) {
  // Optional security: checking an auth header
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // To prevent timeout issues on basic Vercel tiers, we can start the run
  // asynchronously and immediately return a 200 response.
  // Note: Depending on Vercel plan, background tasks may still be terminated. 
  // Awaiting the agent is safer if the function maxDuration is increased.
  
  try {
    // We await it here. Ensure vercel.json maxDuration is set high.
    await runAgent();
    return res.status(200).json({ success: true, message: 'Agent run completed successfully.' });
  } catch (error) {
    console.error('Agent run failed:', error);
    return res.status(500).json({ error: 'Agent run failed' });
  }
}
