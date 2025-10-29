
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { useCallback, useRef, useState, useEffect } from "react";
import { InterviewState, Language } from "../types";

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


// --- System Instructions for the AI Agent (Bilingual) ---
const SYSTEM_INSTRUCTION_EN = `You are a friendly, professional, and empathetic AI agent designed to conduct an "AI Readiness" check. Your goal is to assess a user's mental, cognitive, and technical readiness for adopting AI technologies.

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

const SYSTEM_INSTRUCTION_DE = `Du bist ein freundlicher, professioneller und einfühlsamer KI-Agent, der einen "KI-Bereitschafts-Check" durchführen soll. Dein Ziel ist es, die mentale, kognitive und technische Bereitschaft eines Nutzers für die Einführung von KI-Technologien zu bewerten.

Der Check ist in drei Hauptteile gegliedert. Du musst den Nutzer der Reihe nach durch diese Teile führen. Stelle jeden Teil kurz vor, bevor du mit den Fragen für diesen Abschnitt beginnst. Stelle immer nur eine Frage auf einmal und warte auf die Antwort des Nutzers.

Dein Tonfall sollte gesprächig und ermutigend sein. Verwende gegebenenfalls szenariobasierte Fragen, um das Gespräch ansprechender zu gestalten.

Hier ist die Struktur, der du folgen musst:

Teil 1: Individuelle Hürden bei der KI-Einführung
Ziel: Mentale Barrieren und Einstellungen gegenüber KI verstehen.
Beginne diesen Abschnitt mit einer Formulierung wie: "Lassen Sie uns zu Beginn ein wenig über Ihre persönliche Perspektive auf KI sprechen."
Stelle Fragen zu diesen 5 Kategorien:
1.  Vertrauen/Transparenz (z.B., "Stellen Sie sich vor, ein KI-Tool trifft eine Entscheidung, die Ihre Arbeit beeinflusst. Wie wichtig wäre es für Sie zu verstehen, wie es zu dieser Entscheidung gekommen ist?")
2.  Emotionale Verbindung (z.B., "Manche Leute empfinden KI als 'kalt' oder ohne menschliche Note. Haben Sie das bei einer Technologie auch schon einmal so empfunden?")
3.  Flexibilität (z.B., "Wenn ein KI-Tool eine völlig neue Art vorschlagen würde, eine Ihnen gut bekannte Aufgabe zu erledigen, wie würden Sie wahrscheinlich reagieren?")
4.  Autonomie/Kontrolle (z.B., "Wie würden Sie sich bei einem KI-System fühlen, das Teile Ihrer Arbeit automatisiert, ohne jedes Mal Ihre Zustimmung einzuholen?")
5.  Menschliche Präferenz (z.B., "Wenn Sie Hilfe benötigen, bevorzugen Sie es im Allgemeinen, eine Person zu fragen oder ein automatisiertes System zu nutzen, und warum?")

Teil 2: Kognitive & fachliche Bereitschaft
Ziel: Die Fähigkeit des Nutzers bewerten, KI effektiv zu nutzen.
Beginne diesen Abschnitt mit einer Formulierung wie: "Vielen Dank fürs Teilen. Lassen Sie uns nun dazu übergehen, wie Sie mit KI-Tools interagieren und diese nutzen könnten."
Stelle Fragen zu:
1.  KI-Verständnis (z.B., "Was ist Ihrer Meinung nach der Hauptzweck von KI am Arbeitsplatz, in Ihren eigenen Worten?")
2.  Prompting-Fähigkeiten (z.B., "Wenn Sie eine KI verwenden würden, um eine E-Mail zu schreiben, welche wichtigen Informationen würden Sie ihr geben, um das beste Ergebnis zu erzielen?")
3.  Problemlösung (z.B., "Angenommen, eine KI gibt Ihnen eine Antwort, die falsch zu sein scheint. Was wären Ihre nächsten Schritte?")

Teil 3: Technologische Bereitschaft
Ziel: Die praktische und technische Reife des Nutzers prüfen.
Beginne diesen Abschnitt mit einer Formulierung wie: "Okay, wir sind fast fertig. Für den letzten Teil möchte ich Ihnen noch ein paar Fragen zu den von Ihnen genutzten Werkzeugen und Technologien stellen."
Stelle Fragen zu:
1.  Tool-Vertrautheit (z.B., "Können Sie mir von einem digitalen Tool oder einer App erzählen, die Sie kürzlich gelernt haben, und wie Sie dabei vorgegangen sind?")
2.  Datenumgang (z.B., "Welche Gedanken machen Sie sich über Datenschutz und Sicherheit, wenn Sie ein neues Online-Tool verwenden?")
3.  Automatisierungs-Affinität (z.B., "Gibt es wiederkehrende Aufgaben in Ihrer täglichen Arbeit, von denen Sie sich wünschen, sie könnten automatisiert werden?")

Abschluss:
Nach dem letzten Abschnitt, bedanke dich beim Nutzer für seine Zeit und schließe den Check ab. Zum Beispiel: "Das sind alle Fragen, die ich habe. Vielen Dank für Ihre Zeit und dafür, dass Sie Ihre Gedanken geteilt haben. Hiermit ist Ihr KI-Bereitschafts-Check abgeschlossen."
Versuche nicht, die Antworten des Nutzers während des Gesprächs zu bewerten oder zu analysieren. Führe einfach nur den Check durch.
Beginne das Gespräch, indem du dich und den Zweck des Checks vorstellst. Zum Beispiel: "Hallo! Ich bin Ihr persönlicher Berater für KI-Bereitschaft. Ich werde Sie durch ein kurzes, sprachbasiertes Gespräch führen, um Ihre Perspektive auf KI zu erkunden. Sollen wir anfangen?"
`;

const SYSTEM_INSTRUCTIONS = {
  en: SYSTEM_INSTRUCTION_EN,
  de: SYSTEM_INSTRUCTION_DE,
};

export function useLiveSession({
  onUpdate,
  onStateChange,
  onError,
  language,
}: {
  onUpdate: (transcript: string, isFinal: boolean, source: 'user' | 'ai') => void;
  onStateChange: (state: InterviewState) => void;
  onError: (message: string) => void;
  language: Language;
}) {
  const [session, setSession] = useState<any | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputGainNodeRef = useRef<GainNode | null>(null);
  const isPausedRef = useRef(false);
  const isMicrophoneMutedRef = useRef(false);
  const isSpeakerMutedRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const errorOccurredRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const userTranscriptRef = useRef('');
  const aiTranscriptRef = useRef('');
  
  const aiTextChunkQueue = useRef<string[]>([]);
  const scheduledTextQueue = useRef<{ text: string; displayTime: number }[]>([]);
  const scheduledFinalizeTime = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const processTextQueue = useCallback(() => {
    if (outputAudioContextRef.current) {
        const currentTime = outputAudioContextRef.current.currentTime;
        let didUpdate = false;
        
        while (scheduledTextQueue.current.length > 0 && scheduledTextQueue.current[0].displayTime <= currentTime) {
            const item = scheduledTextQueue.current.shift();
            if (item) {
                aiTranscriptRef.current += item.text;
                didUpdate = true;
            }
        }

        if (didUpdate) {
            onUpdate(aiTranscriptRef.current, false, 'ai');
        }

        const isTurnComplete = !!scheduledFinalizeTime.current;
        let shouldFinalize = false;

        if (isTurnComplete && scheduledTextQueue.current.length === 0 && scheduledFinalizeTime.current && scheduledFinalizeTime.current <= currentTime) {
            shouldFinalize = true;
        }
        
        if (shouldFinalize) {
            if (aiTranscriptRef.current) {
                onUpdate(aiTranscriptRef.current, true, 'ai');
            }
            userTranscriptRef.current = '';
            aiTranscriptRef.current = '';
            scheduledFinalizeTime.current = null;
            aiTextChunkQueue.current = [];
        }
    }
    animationFrameRef.current = requestAnimationFrame(processTextQueue);
  }, [onUpdate]);


  const startSession = useCallback(async ({ initialMicMuted, initialSpeakerMuted }: { initialMicMuted: boolean; initialSpeakerMuted: boolean; }) => {
    onStateChange(InterviewState.STARTING);
    isPausedRef.current = false;
    isMicrophoneMutedRef.current = initialMicMuted;
    isSpeakerMutedRef.current = initialSpeakerMuted;
    sessionStartedRef.current = false;
    errorOccurredRef.current = false;
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
          systemInstruction: SYSTEM_INSTRUCTIONS[language],
        },
        callbacks: {
          onopen: () => {
            sessionPromise.then((session) => {
              session.sendRealtimeInput({ text: "Start" });
            });
            
            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = inputAudioContext;
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              if (!sessionStartedRef.current || isPausedRef.current || isMicrophoneMutedRef.current) return;

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
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && !sessionStartedRef.current) {
                sessionStartedRef.current = true;
                onStateChange(InterviewState.IN_PROGRESS);
            }

            if (message.serverContent?.inputTranscription) {
              const { text } = message.serverContent.inputTranscription;
              userTranscriptRef.current += text;
              onUpdate(userTranscriptRef.current, false, 'user');
            }
        
            if (message.serverContent?.outputTranscription) {
              const { text } = message.serverContent.outputTranscription;
              aiTextChunkQueue.current.push(text);
            }
        
            if (message.serverContent?.turnComplete) {
              scheduledFinalizeTime.current = nextStartTimeRef.current;
            }
        
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              // Stop all audio playback
              for (const source of audioSourcesRef.current.values()) {
                source.stop(0);
                audioSourcesRef.current.delete(source);
              }
              nextStartTimeRef.current = 0;

              // Clear future text/audio processing queues
              aiTextChunkQueue.current = [];
              scheduledTextQueue.current = [];
              scheduledFinalizeTime.current = null;
              
              // Finalize the current AI text with an interruption marker, if it exists
              if (aiTranscriptRef.current.trim()) {
                aiTranscriptRef.current += '...';
                onUpdate(aiTranscriptRef.current, true, 'ai');
              }

              // Reset transcript refs for the new turn.
              // This preserves the last AI message (by finalizing it above)
              // and clears the user's message to prevent duplication.
              aiTranscriptRef.current = '';
              userTranscriptRef.current = '';
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
        
              const textChunk = aiTextChunkQueue.current.shift();
              if (textChunk) {
                scheduledTextQueue.current.push({ text: textChunk, displayTime: nextStartTime });
              }
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            errorOccurredRef.current = true;
            const errorMessage = (e.error as Error)?.message || e.message || 'An unknown session error occurred.';
            onError(errorMessage);
          },
          onclose: () => {
             if (!errorOccurredRef.current) {
                onStateChange(InterviewState.FINISHED);
            }
          },
        },
      });

      setSession(await sessionPromise);
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      await outputAudioContext.resume();
      outputAudioContextRef.current = outputAudioContext;

      const gainNode = outputAudioContext.createGain();
      if (initialSpeakerMuted) {
          gainNode.gain.setValueAtTime(0, outputAudioContext.currentTime);
      }
      gainNode.connect(outputAudioContext.destination);
      outputGainNodeRef.current = gainNode;
      
      animationFrameRef.current = requestAnimationFrame(processTextQueue);


    } catch (error) {
      console.error('Failed to start session:', error);
      errorOccurredRef.current = true;
      const errorMessage = (error as Error)?.message || 'Failed to start session.';
      onError(errorMessage);
    }
  }, [onStateChange, onUpdate, processTextQueue, language, onError]);
  
  const pauseSession = useCallback(() => {
    isPausedRef.current = true;
    if (outputAudioContextRef.current?.state === 'running') {
      outputAudioContextRef.current.suspend();
    }
    onStateChange(InterviewState.PAUSED);
  }, [onStateChange]);
  
  const resumeSession = useCallback(() => {
    isPausedRef.current = false;
    if (outputAudioContextRef.current?.state === 'suspended') {
      outputAudioContextRef.current.resume();
    }
    onStateChange(InterviewState.IN_PROGRESS);
  }, [onStateChange]);

  const muteMicrophone = useCallback(() => {
    isMicrophoneMutedRef.current = true;
  }, []);

  const unmuteMicrophone = useCallback(() => {
    isMicrophoneMutedRef.current = false;
  }, []);

  const muteSpeaker = useCallback(() => {
    isSpeakerMutedRef.current = true;
    if (outputGainNodeRef.current && outputAudioContextRef.current) {
        outputGainNodeRef.current.gain.linearRampToValueAtTime(0, outputAudioContextRef.current.currentTime + 0.1);
    }
  }, []);

  const unmuteSpeaker = useCallback(() => {
    isSpeakerMutedRef.current = false;
    if (outputGainNodeRef.current && outputAudioContextRef.current) {
        outputGainNodeRef.current.gain.linearRampToValueAtTime(1, outputAudioContextRef.current.currentTime + 0.1);
    }
  }, []);

  const endSession = useCallback(() => {
    onStateChange(InterviewState.ENDING);
    isPausedRef.current = false;
    isMicrophoneMutedRef.current = false;
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    scriptProcessorRef.current?.disconnect();
    audioContextRef.current?.close().catch(console.error);
    
    if (outputGainNodeRef.current && outputAudioContextRef.current) {
      outputGainNodeRef.current.gain.setValueAtTime(0, outputAudioContextRef.current.currentTime);
    }
    audioSourcesRef.current.forEach(source => source.stop(0));
    audioSourcesRef.current.clear();
    outputAudioContextRef.current?.close().catch(console.error);

    session?.close();
    setSession(null);
    if (!errorOccurredRef.current) {
      onStateChange(InterviewState.FINISHED);
    }
  }, [session, onStateChange]);
  
  const sendTextMessage = useCallback(async (message: string) => {
    if (session) {
      // Interruption check: Is the AI currently generating a response?
      if (aiTranscriptRef.current.trim()) {
        // Stop any playing/scheduled audio immediately
        for (const source of audioSourcesRef.current.values()) {
          source.stop(0);
          audioSourcesRef.current.delete(source);
        }
        nextStartTimeRef.current = 0;

        // Clear any pending text/audio processing queues
        aiTextChunkQueue.current = [];
        scheduledTextQueue.current = [];
        scheduledFinalizeTime.current = null;
        
        // Finalize the AI's current partial response with an interruption marker
        aiTranscriptRef.current += '...';
        onUpdate(aiTranscriptRef.current, true, 'ai');
      }

      // Reset transcript refs to ensure a clean state for the new turn
      aiTranscriptRef.current = '';
      userTranscriptRef.current = '';

      // Now, add the user's new message to the display by calling the update handler
      onUpdate(message, true, 'user');
      
      // Finally, send the user's message to the AI to get a new response
      session.sendRealtimeInput({ text: message });
    }
  }, [session, onUpdate]);

  return { startSession, endSession, pauseSession, resumeSession, sendTextMessage, muteMicrophone, unmuteMicrophone, muteSpeaker, unmuteSpeaker };
}