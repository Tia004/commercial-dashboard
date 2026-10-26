import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=process.env.TEST_DATA_DIR||mkdtempSync(join(tmpdir(),'commercial-e2e-'));
process.env.TEST_DATA_DIR=dir;
export default defineConfig({
 testDir:'./tests/e2e',workers:1,fullyParallel:false,timeout:60000,
 use:{baseURL:'http://127.0.0.1:3101',channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,trace:'retain-on-failure',screenshot:'only-on-failure'},
 outputDir:'artifacts/qa/playwright',
 webServer:{command:'npm run dev -- -p 3101',url:'http://127.0.0.1:3101',timeout:90000,reuseExistingServer:false,env:{APP_ORIGIN:'http://127.0.0.1:3101',TURSO_DATABASE_URL:'file:'+join(dir,'test.sqlite'),TURSO_AUTH_TOKEN:'',RESEND_API_KEY:'',BREVO_API_KEY:'',SMTP_HOST:'',SMTP_USER:'',SMTP_PASSWORD:'',SMTP_PASS:'',GEMINI_API_KEY:'',MAIL_PREVIEW_FILE:join(dir,'mail.jsonl'),MCP_API_TOKEN:'',MCP_OWNER_USER_ID:''}},
});
