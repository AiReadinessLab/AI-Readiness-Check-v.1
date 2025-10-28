
export enum InterviewState {
  NOT_STARTED,
  STARTING,
  IN_PROGRESS,
  PAUSED,
  ENDING,
  FINISHED,
  ERROR,
}

export interface Transcript {
  source: 'user' | 'ai';
  text: string;
  isFinal: boolean;
}

export type Language = 'en' | 'de';
