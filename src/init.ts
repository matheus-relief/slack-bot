import { App } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';

// Commands
import clock from './commands/clock';
import download from './commands/export';

export default (app: App<StringIndexed>) => {
  clock.init(app);
  download.init(app);
};
