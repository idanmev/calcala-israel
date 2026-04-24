import { exec } from 'child_process';
import path from 'path';
import util from 'util';

const execPromise = util.promisify(exec);

export default async function handler(req: any, res: any) {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'ssg.js');
    console.log(`[REBUILD-SSG] Executing ${scriptPath}...`);
    const { stdout, stderr } = await execPromise(`node ${scriptPath}`);
    console.log(`[REBUILD-SSG] Output: ${stdout}`);
    if (stderr) console.error(`[REBUILD-SSG] Stderr: ${stderr}`);
    
    return res.status(200).json({ success: true, message: 'SSG rebuild complete' });
  } catch (err: any) {
    console.error(`[REBUILD-SSG] Error:`, err);
    return res.status(500).json({ error: String(err) });
  }
}
