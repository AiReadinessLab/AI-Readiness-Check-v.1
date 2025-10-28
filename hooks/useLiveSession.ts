import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { useCallback, useRef, useState } from "react";
import { InterviewState } from "../types";

// --- Audio Utility Functions ---
const encode = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};


// --- System Instruction for the AI Agent ---
const SYSTEM_INSTRUCTION = `You are a friendly, professional, and empathetic AI agent designed to conduct an "AI Readiness" check. Your goal is to assess a user's mental, cognitive, and technical readiness for adopting AI technologies.

The check is structured into three main parts. You must guide the user through them in order. Introduce each part briefly before you begin asking questions for that section. Ask only one question at a time and wait for the user's response.

Your tone should be conversational and encouraging. Use scenario-based questions where appropriate to make it more engaging.

Here is the structure you must follow:

Part 1: Individual Constraints of AI Adoption
Goal: Understand mental barriers and attitudes towards AI.
Start this section by saying something like: "To begin, let's talk a little about your personal perspective on AI."
Ask questions related to these 5 categories:
1.  Trust/Transparency (e.g., "Imagine an AI tool makes a decision that affects your work. How important is it for you to understand how it reached that decision?")
2.  Emotional Connection (e.g., "Some people feel AI is 'cold' or lacks a human touch. Have you ever felt that way about a technology?")
3.  Flexibility (e.g., "If an AI tool suggested a completely new way of doing a task you know well, how would you likely react?")
4.  Autonomy/Control (e.g., "How would you feel about an AI system that automates parts of your job without asking for your approval each time?")
5.  Human Preference (e.g., "When you need help, do you generally prefer to ask a person or use an automated system, and why?")

Part 2: Cognitive & Skill Readiness
Goal: Assess the user's ability to use AI effectively.
Start this section by saying something like: "Great, thanks for sharing. Now, let's move on to how you might interact with and use AI tools."
Ask questions related to:
1.  AI Understanding (e.g., "In your own words, what is the main purpose of AI in the workplace?")
2.  Prompting Skills (e.g., "If you were using an AI to write an email, what key pieces of information would you give it to get the best result?")
3.  Problem-Solving (e.g., "Suppose an AI gives you an answer that seems wrong. What would be your next steps?")

Part 3: Technological Readiness
Goal: Check the user's practical and technical maturity.
Start this section by saying something like: "Okay, we're almost done. For the last part, I'd like to ask a few questions about the tools and technology you use."
Ask questions related to:
1.  Tool Familiarity (e.g., "Can you tell me about a digital tool or app you learned recently and how you went about it?")
2.  Data Handling (e.g., "When using a new online tool, what are your thoughts on data privacy and security?")
3.  Automation Affinity (e.g., "Are there any repetitive tasks in your daily work that you wish could be automated?")

Conclusion:
After the final section, thank the user for their time and conclude the check. For example: "That's all the questions I have. Thank you so much for your time and for sharing your thoughts. This concludes your AI Readiness Check."
Do not attempt to score or analyze the user's responses during the conversation. Simply conduct the check.
Start the conversation by introducing yourself and the purpose of the check. For example: "Hello! I'm your personal AI readiness assessor. I'll be guiding you through a short voice-based conversation to explore your perspective on AI. Shall we begin?"
`;


export function useLiveSession({
  onUpdate,
  onStateChange,
}: {
  onUpdate: (transcript: string, isFinal: boolean, source: 'user' | 'ai') => void;
  onStateChange: (state: InterviewState) => void;
}) {
  const [session, setSession] = useState<any | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputGainNodeRef = useRef<GainNode | null>(null);
  const isPausedRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const userTranscriptRef = useRef('');
  const aiTranscriptRef = useRef('');
  const aiTextChunkQueue = useRef<string[]>([]);


  const startSession = useCallback(async () => {
    onStateChange(InterviewState.STARTING);
    isPausedRef.current = false;
    sessionStartedRef.current = false;
    try {
      if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
      }
      aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const sessionPromise = aiRef.current.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: () => {
            // State is now transitioned in onmessage upon first audio chunk
            // Prompt the AI to start the conversation with its introduction
            sessionPromise.then((session) => {
              session.sendRealtimeInput({ text: "Start" });
            });
            
            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = inputAudioContext;
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              if (isPausedRef.current) return;

              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle AI audio output: Dequeue text and schedule its synchronized display
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && !sessionStartedRef.current) {
                sessionStartedRef.current = true;
                onStateChange(InterviewState.IN_PROGRESS);
            }

            // Handle user input transcription (immediate update)
            if (message.serverContent?.inputTranscription) {
              const { text } = message.serverContent.inputTranscription;
              userTranscriptRef.current += text;
              onUpdate(userTranscriptRef.current, false, 'user');
            }
        
            // Handle AI output transcription: Queue the text instead of displaying immediately
            if (message.serverContent?.outputTranscription) {
              const { text } = message.serverContent.outputTranscription;
              aiTextChunkQueue.current.push(text);
            }
        
            // Handle turn completion
            if (message.serverContent?.turnComplete) {
              const finalizeTime = nextStartTimeRef.current;
              const outputAudioContext = outputAudioContextRef.current;
        
              const finalize = () => {
                if (aiTranscriptRef.current) {
                  onUpdate(aiTranscriptRef.current, true, 'ai');
                }
                userTranscriptRef.current = '';
                aiTranscriptRef.current = '';
              };
        
              if (outputAudioContext) {
                const delay = (finalizeTime - outputAudioContext.currentTime) * 1000;
                setTimeout(finalize, Math.max(0, delay));
              } else {
                finalize(); // Fallback if audio context is not available
              }
            }
        
            // Handle interruptions
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              for (const source of audioSourcesRef.current.values()) {
                source.stop();
                audioSourcesRef.current.delete(source);
              }
              nextStartTimeRef.current = 0;
              aiTextChunkQueue.current = []; // Clear pending text on interruption
            }
        
            if (base64Audio) {
              const outputAudioContext = outputAudioContextRef.current;
              if (!outputAudioContext || !outputGainNodeRef.current) return;
        
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
              const currentTime = outputAudioContext.currentTime;
              const nextStartTime = Math.max(nextStartTimeRef.current, currentTime);
        
              const source = outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputGainNodeRef.current);
              source.start(nextStartTime);
        
              nextStartTimeRef.current = nextStartTime + audioBuffer.duration;
        
              audioSourcesRef.current.add(source);
              source.addEventListener('ended', () => {
                audioSourcesRef.current.delete(source);
              });
        
              // Dequeue the corresponding text chunk and schedule its display to sync with audio
              const textChunk = aiTextChunkQueue.current.shift();
              if (textChunk) {
                const delay = (nextStartTime - currentTime) * 1000;
                setTimeout(() => {
                  aiTranscriptRef.current += textChunk;
                  // isFinal is false for intermediate updates; turnComplete handles the final update
                  onUpdate(aiTranscriptRef.current, false, 'ai');
                }, Math.max(0, delay));
              }
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            onStateChange(InterviewState.ERROR);
          },
          onclose: () => {
            onStateChange(InterviewState.FINISHED);
          },
        },
      });

      setSession(await sessionPromise);
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      await outputAudioContext.resume();
      outputAudioContextRef.current = outputAudioContext;

      const gainNode = outputAudioContext.createGain();
      gainNode.connect(outputAudioContext.destination);
      outputGainNodeRef.current = gainNode;


    } catch (error) {
      console.error('Failed to start session:', error);
      onStateChange(InterviewState.ERROR);
    }
  }, [onStateChange, onUpdate]);
  
  const pauseSession = useCallback(() => {
    isPausedRef.current = true;
    if (outputGainNodeRef.current && outputAudioContextRef.current) {
        // Fix typo: outputAudioiacontextRef -> outputAudioContextRef
        outputGainNodeRef.current.gain.setValueAtTime(0, outputAudioContextRef.current.currentTime);
    }
    onStateChange(InterviewState.PAUSED);
  }, [onStateChange]);
  
  const resumeSession = useCallback(() => {
    isPausedRef.current = false;
    if (outputGainNodeRef.current && outputAudioContextRef.current) {
        outputGainNodeRef.current.gain.setValueAtTime(1, outputAudioContextRef.current.currentTime);
    }
    onStateChange(InterviewState.IN_PROGRESS);
  }, [onStateChange]);


  const endSession = useCallback(() => {
    onStateChange(InterviewState.ENDING);
    isPausedRef.current = false;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    scriptProcessorRef.current?.disconnect();
    audioContextRef.current?.close().catch(console.error);
    
    if (outputGainNodeRef.current && outputAudioContextRef.current) {
      outputGainNodeRef.current.gain.setValueAtTime(0, outputAudioContextRef.current.currentTime);
    }
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    outputAudioContextRef.current?.close().catch(console.error);

    session?.close();
    setSession(null);
    onStateChange(InterviewState.FINISHED);
  }, [session, onStateChange]);

  return { startSession, endSession, pauseSession, resumeSession };
}