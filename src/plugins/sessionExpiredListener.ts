import { registerPlugin } from '@capacitor/core';

export interface SessionExpiredListenerPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}

const SessionExpiredListener = registerPlugin<SessionExpiredListenerPlugin>('SessionExpiredListener');

export default SessionExpiredListener;
