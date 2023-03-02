require('dotenv').config();
import { App } from '@slack/bolt';
import { disconnect } from './db';
import init from './init';

const main = async () => {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  });

  // Initialize all the commands
  init(app);

  const port = process.env.PORT || 3000;
  await app.start(port);

  console.log(`Makimaki bot running on port ${port}!`);
};

main().then(disconnect);
