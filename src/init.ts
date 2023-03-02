import { App } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import clock from './commands/clock';

export default (app: App<StringIndexed>) => {
  clock.init(app);
};
