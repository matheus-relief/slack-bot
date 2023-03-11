import { App } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';

// Commands
import clock from './commands/clock';
import download from './commands/export';
import add from './commands/add';
import track from './commands/track';

export default (app: App<StringIndexed>) => {
  clock.init(app);
  download.init(app);
  add.init(app);
  track.init(app);
};
