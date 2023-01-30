import { App } from "@slack/bolt";
require("dotenv").config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

(async () => {
  const port = process.env.PORT || 3000;
  await app.start(port);

  console.log(`Bot running on port ${port}!`);
})();
