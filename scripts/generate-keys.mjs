import { randomBytes } from 'node:crypto';
for (const name of ['ADMIN_TOKEN','CRON_SECRET','RUNNER_TOKEN']) console.log(`${name}=${randomBytes(32).toString('hex')}`);
