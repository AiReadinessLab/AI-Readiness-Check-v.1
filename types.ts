
export enum InterviewState {
  NOT_STARTED,
  PRE_INTERVIEW,
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

export type InputMode = 'voice' | 'text';