
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { InterviewState, Transcript, Language, InputMode } from './types';
import { useLiveSession } from './hooks/useLiveSession';

const UI_STRINGS = {
  en: {
    headerTitle: "AI Readiness Check",
    headerSubtitle: "Your personal AI readiness assessor",
    welcomeTitle: "Welcome!",
    welcomeText: "Click the button below to start your AI Readiness Check. You can use your voice or type your answers.",
    startCheck: "Start Check",
    connecting: "Connecting...",
    connectingText: "The AI assistant is preparing your check. This will just take a moment.",
    statusInProgress: "Check in progress...",
    statusPaused: "Interview Paused",
    statusMuted: "Audio muted.",
    statusMicrophoneMuted: "Microphone muted.",
    statusSpeakerMuted: "Speaker muted.",
    statusEnding: "Ending check...",
    statusTextInput: "Text input active",
    errorText: "An error occurred. Please refresh and try again.",
    quotaErrorTitle: "Quota Exceeded",
    quotaErrorText: "It looks like the API usage limit has been reached. To continue using this feature, please ensure that billing is enabled for your Google Cloud project.",
    quotaErrorLink: "Learn more about billing",
    finishedText: "Check Finished. Thank you!",
    pauseCheckAria: "Pause Interview",
    resumeCheckAria: "Resume Interview",
    startCheckAria: "Start Check",
    muteAudioAria: "Mute Microphone",
    unmuteAudioAria: "Unmute Microphone",
    muteSpeakerAria: "Mute Speaker",
    unmuteSpeakerAria: "Unmute Speaker",
    switchToTextModeAria: "Switch to text input",
    switchToVoiceModeAria: "Switch to voice input",
    textInputPlaceholder: "Type your answer...",
    sendAria: "Send message",
  },
  de: {
    headerTitle: "AI Readiness Check",
    headerSubtitle: "Ihr persönlicher Berater zur KI-Bereitschaft",
    welcomeTitle: "Willkommen!",
    welcomeText: "Klicken Sie auf den Button, um Ihren AI Readiness Check zu starten. Sie können Ihre Stimme verwenden oder Ihre Antworten tippen.",
    startCheck: "Check starten",
    connecting: "Verbinde...",
    connectingText: "Der KI-Assistent bereitet Ihren Check vor. Dies dauert nur einen Moment.",
    statusInProgress: "Check läuft...",
    statusPaused: "Interview Pausiert",
    statusMuted: "Audio stummgeschaltet.",
    statusMicrophoneMuted: "Mikrofon stummgeschaltet.",
    statusSpeakerMuted: "Lautsprecher stummgeschaltet.",
    statusEnding: "Check wird beendet...",
    statusTextInput: "Texteingabe aktiv",
    errorText: "Ein Fehler ist aufgetreten. Bitte laden Sie die Seite neu und versuchen Sie es erneut.",
    quotaErrorTitle: "Kontingent überschritten",
    quotaErrorText: "Es scheint, als wäre das API-Nutzungslimit erreicht. Um diese Funktion weiterhin zu nutzen, stellen Sie bitte sicher, dass die Abrechnung für Ihr Google Cloud-Projekt aktiviert ist.",
    quotaErrorLink: "Mehr über die Abrechnung erfahren",
    finishedText: "Check beendet. Vielen Dank!",
    pauseCheckAria: "Interview pausieren",
    resumeCheckAria: "Interview fortsetzen",
    startCheckAria: "Check starten",
    muteAudioAria: "Mikrofon stummschalten",
    unmuteAudioAria: "Mikrofon aktivieren",
    muteSpeakerAria: "Lautsprecher stummschalten",
    unmuteSpeakerAria: "Lautsprecher aktivieren",
    switchToTextModeAria: "Auf Texteingabe wechseln",
    switchToVoiceModeAria: "Auf Spracheingabe wechseln",
    textInputPlaceholder: "Geben Sie Ihre Antwort ein...",
    sendAria: "Nachricht senden",
  },
};

const Header: React.FC<{ T: typeof UI_STRINGS['en'] }> = ({ T }) => (
  <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 shadow-md w-full">
    <div className="container mx-auto max-w-4xl text-center">
      <h1 className="text-3xl font-bold tracking-tight">{T.headerTitle}</h1>
      <p className="mt-1 text-lg opacity-90">{T.headerSubtitle}</p>
    </div>
  </header>
);

const WelcomeScreen: React.FC<{ onStart: () => void; state: InterviewState; T: typeof UI_STRINGS['en'] }> = ({ onStart, state, T }) => (
  <div className="text-center flex flex-col items-center justify-center h-full p-8">
    <div className="text-6xl text-blue-500 mb-4">
      <i className="fa-regular fa-face-smile"></i>
    </div>
    <h2 className="text-2xl font-semibold text-gray-800 mb-2">{T.welcomeTitle}</h2>
    <p className="text-gray-600 max-w-md">{T.welcomeText}</p>
    <div className="mt-16">
      <MainControlButton onClick={onStart} state={state} T={T} />
      <p className="mt-4 text-gray-700 font-medium">{T.startCheck}</p>
    </div>
  </div>
);

const LoadingScreen: React.FC<{ T: typeof UI_STRINGS['en'] }> = ({ T }) => (
  <div className="text-center flex flex-col items-center justify-center h-full p-8">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-6"></div>
    <h2 className="text-xl font-semibold text-gray-800">{T.connecting}</h2>
    <p className="text-gray-600 mt-2 max-w-xs">{T.connectingText}</p>
  </div>
);

const QuotaErrorScreen: React.FC<{ T: typeof UI_STRINGS['en'] }> = ({ T }) => (
  <div className="text-center flex flex-col items-center justify-center h-full p-8">
    <div className="text-6xl text-red-500 mb-4">
      <i className="fa-solid fa-triangle-exclamation"></i>
    </div>
    <h2 className="text-2xl font-semibold text-gray-800 mb-2">{T.quotaErrorTitle}</h2>
    <p className="text-gray-600 max-w-md">{T.quotaErrorText}</p>
    <a 
      href="https://ai.google.dev/gemini-api/docs/billing" 
      target="_blank" 
      rel="noopener noreferrer"
      className="mt-6 inline-block bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-600 transition-colors"
    >
      {T.quotaErrorLink}
    </a>
  </div>
);


const InterviewScreen: React.FC<{
  transcripts: Transcript[];
  state: InterviewState;
  isMicrophoneMuted: boolean;
  isSpeakerMuted: boolean;
  onTogglePause: () => void;
  onToggleMicrophoneMute: () => void;
  onToggleSpeakerMute: () => void;
  T: typeof UI_STRINGS['en'];
  inputMode: InputMode;
  onSwitchToText: () => void;
  onSwitchToVoice: () => void;
  onSendText: (e: React.FormEvent) => void;
  textInputValue: string;
  onTextInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({
  transcripts, state, isMicrophoneMuted, isSpeakerMuted, onTogglePause,
  onToggleMicrophoneMute, onToggleSpeakerMute, T, inputMode,
  onSwitchToText, onSwitchToVoice, onSendText, textInputValue, onTextInputChange
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollEnabled = useRef(true);
  const isPaused = state === InterviewState.PAUSED;

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (scrollContainer && autoScrollEnabled.current) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [transcripts]);

  const handleScroll = useCallback(() => {
    const scrollContainer = scrollRef.current;
    if (scrollContainer) {
      const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 50;
      autoScrollEnabled.current = isAtBottom;
    }
  }, []);

  const getStatusText = () => {
    if (inputMode === 'text') return T.statusTextInput;
    if (isPaused) return T.statusPaused.replace("Interview Pausiert", "Check pausiert.");
    if (state === InterviewState.IN_PROGRESS) return T.statusInProgress;
    if (state === InterviewState.ENDING) return T.statusEnding;
    return "";
  }

  const isSpeakerDisplayedAsMuted = isPaused || isSpeakerMuted;
  const isMicrophoneDisplayedAsMuted = isPaused || isMicrophoneMuted;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="relative flex-grow min-h-0">
        <div ref={scrollRef} onScroll={handleScroll} className="h-full p-6 overflow-y-auto space-y-6">
          {transcripts.map((t, i) => (
            <div key={i} className={`flex items-start gap-3 ${t.source === 'user' ? 'justify-end' : ''}`}>
              {t.source === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white flex-shrink-0">
                  <i className="fa-solid fa-robot text-sm"></i>
                </div>
              )}
              <div className={`p-3 rounded-lg max-w-lg ${t.source === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
                <p style={{ opacity: t.isFinal ? 1 : 0.7 }}>{t.text}</p>
              </div>
              {t.source === 'user' && (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
                  <i className="fa-solid fa-user text-sm"></i>
                </div>
              )}
            </div>
          ))}
        </div>
         {isPaused && (
            <div className="absolute inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex flex-col items-center justify-center z-10 pointer-events-none transition-opacity duration-300">
                <div className="text-gray-600 text-6xl">
                    <i className="fa-solid fa-pause"></i>
                </div>
                <p className="mt-4 text-2xl font-semibold text-gray-700">{T.statusPaused}</p>
            </div>
        )}
      </div>
      <div className="p-6 border-t border-gray-200 bg-white">
        {inputMode === 'voice' ? (
          <div className="flex flex-col items-center">
             <div className="flex items-center justify-center w-full max-w-lg mx-auto">
                <div className="flex-1 flex justify-end">
                    <button type="button" onClick={onToggleSpeakerMute} disabled={isPaused} aria-label={isSpeakerMuted ? T.unmuteSpeakerAria : T.muteSpeakerAria} className={`${isSpeakerDisplayedAsMuted ? 'text-red-500' : 'text-gray-500'} ${!isPaused && (isSpeakerMuted ? 'hover:text-red-600' : 'hover:text-blue-600')} disabled:opacity-50 transition-colors p-4 rounded-full`}>
                        <i className={`fa-solid ${isSpeakerDisplayedAsMuted ? 'fa-volume-xmark' : 'fa-volume-high'} text-2xl w-8 text-center`}></i>
                    </button>
                    <button type="button" onClick={onToggleMicrophoneMute} disabled={isPaused} aria-label={isMicrophoneMuted ? T.unmuteAudioAria : T.muteAudioAria} className={`${isMicrophoneDisplayedAsMuted ? 'text-red-500' : 'text-gray-500'} ${!isPaused && (isMicrophoneMuted ? 'hover:text-red-600' : 'hover:text-blue-600')} disabled:opacity-50 transition-colors p-4 rounded-full ml-2`}>
                        <i className={`fa-solid ${isMicrophoneDisplayedAsMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-2xl w-8 text-center`}></i>
                    </button>
                </div>
                <div className="px-4">
                    <MainControlButton onClick={onTogglePause} state={state} T={T} />
                </div>
                <div className="flex-1 flex justify-start">
                    <button type="button" onClick={onSwitchToText} disabled={isPaused} aria-label={T.switchToTextModeAria} className="text-gray-500 hover:text-blue-600 disabled:opacity-50 transition-colors p-4 rounded-full">
                        <i className="fa-solid fa-keyboard text-2xl w-8 text-center"></i>
                    </button>
                </div>
            </div>
             <p className="mt-4 text-gray-700 font-medium h-6">
                {getStatusText()}
            </p>
          </div>
        ) : (
          <form onSubmit={onSendText} className="w-full flex items-center gap-2">
            <button type="button" onClick={onToggleSpeakerMute} disabled={isPaused} aria-label={isSpeakerMuted ? T.unmuteSpeakerAria : T.muteSpeakerAria} className={`${isSpeakerDisplayedAsMuted ? 'text-red-500' : 'text-gray-500'} ${!isPaused && (isSpeakerMuted ? 'hover:text-red-600' : 'hover:text-blue-600')} disabled:opacity-50 transition-colors w-12 h-12 flex items-center justify-center rounded-full flex-shrink-0`}>
                <i className={`fa-solid ${isSpeakerDisplayedAsMuted ? 'fa-volume-xmark' : 'fa-volume-high'} text-xl`}></i>
            </button>
            <button type="button" onClick={onSwitchToVoice} disabled={isPaused} aria-label={T.switchToVoiceModeAria} className="text-gray-500 hover:text-blue-600 disabled:opacity-50 transition-colors w-12 h-12 flex items-center justify-center rounded-full flex-shrink-0">
                <i className="fa-solid fa-comment text-xl"></i>
            </button>
            {(state === InterviewState.PAUSED || state === InterviewState.IN_PROGRESS) &&
                <button type="button" onClick={onTogglePause} aria-label={state === InterviewState.PAUSED ? T.resumeCheckAria : T.pauseCheckAria} className={`transition-colors w-12 h-12 flex items-center justify-center rounded-full flex-shrink-0 ${state === InterviewState.PAUSED ? 'text-blue-500 hover:text-blue-600' : 'text-yellow-500 hover:text-yellow-600'}`}>
                    <i className={`fa-solid ${state === InterviewState.PAUSED ? 'fa-play' : 'fa-pause'} text-xl`}></i>
                </button>
            }
            <input
              type="text"
              value={textInputValue}
              onChange={onTextInputChange}
              placeholder={T.textInputPlaceholder}
              className="flex-grow border border-gray-300 rounded-full h-12 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={T.textInputPlaceholder}
            />
            <button type="submit" disabled={!textInputValue.trim() || state === InterviewState.PAUSED} aria-label={T.sendAria} className="bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0 disabled:bg-gray-400 transition-colors">
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};


const MainControlButton: React.FC<{ onClick: () => void; state: InterviewState, T: typeof UI_STRINGS['en'] }> = ({ onClick, state, T }) => {
  const isDisabled = state === InterviewState.STARTING || state === InterviewState.ENDING || state === InterviewState.FINISHED || state === InterviewState.ERROR;

  const getAppearance = () => {
    switch (state) {
      case InterviewState.NOT_STARTED:
        return { icon: 'fa-play', color: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300', pulse: false, label: T.startCheckAria };
      case InterviewState.STARTING:
        return { icon: 'fa-play', color: 'bg-gray-400 cursor-not-allowed', pulse: true, label: T.startCheckAria };
      case InterviewState.IN_PROGRESS:
        return { icon: 'fa-pause', color: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-300', pulse: true, label: T.pauseCheckAria };
      case InterviewState.PAUSED:
        return { icon: 'fa-play', color: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300', pulse: false, label: T.resumeCheckAria };
      default: // ENDING, FINISHED, ERROR
        return { icon: 'fa-circle', color: 'bg-gray-400 cursor-not-allowed', pulse: false, label: "" };
    }
  };

  const { icon, color, pulse, label } = getAppearance();

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`relative overflow-hidden w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-4 focus:ring-opacity-50 text-white ${color}`}
      aria-label={label}
    >
       <div className="relative">
        <i className={`fa-solid ${icon} text-3xl`}></i>
        {pulse && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white opacity-20 animate-ping"></div>}
       </div>
    </button>
  );
};

const App: React.FC = () => {
  const [interviewState, setInterviewState] = useState<InterviewState>(InterviewState.NOT_STARTED);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [language, setLanguage] = useState<Language>('en');
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const userTranscriptRef = useRef<string>('');
  const aiTranscriptRef = useRef<string>('');
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get('lang');
    if (lang === 'de') {
      setLanguage('de');
      document.documentElement.lang = 'de';
    } else {
      setLanguage('en');
      document.documentElement.lang = 'en';
    }
  }, []);

  const T = UI_STRINGS[language];
  
  const resetState = useCallback(() => {
    setTranscripts([]);
    setInterviewState(InterviewState.NOT_STARTED);
    setInputMode('voice');
    setIsMicrophoneMuted(false);
    setIsSpeakerMuted(false);
    setTextInputValue('');
    setErrorMessage(null);
  }, []);

  const handleStateChange = useCallback((newState: InterviewState) => {
    if (newState === InterviewState.ERROR) return;

    setInterviewState(newState);
    if (newState === InterviewState.FINISHED) {
      setTimeout(resetState, 3000);
    }
  }, [resetState]);
  
  const handleError = useCallback((message: string) => {
    setErrorMessage(message);
    setInterviewState(InterviewState.ERROR);
  }, []);

  const handleUpdate = useCallback((text: string, isFinal: boolean, source: 'user' | 'ai') => {
    if (source === 'user') {
      userTranscriptRef.current = text;
    } else {
      aiTranscriptRef.current = text;
    }

    setTranscripts(prev => {
      const newTranscripts = [...prev];
      let last = newTranscripts[newTranscripts.length - 1];

      if (source === 'user' && last && last.source === 'ai' && !last.isFinal) {
        last.isFinal = true;
      }
      if (source === 'ai' && last && last.source === 'user' && !last.isFinal) {
        last.isFinal = true;
      }

      const currentText = source === 'user' ? userTranscriptRef.current : aiTranscriptRef.current;
      
      if (last && last.source === source && !last.isFinal) {
        last.text = currentText;
        last.isFinal = isFinal;
      } else if (currentText) {
        newTranscripts.push({ source, text: currentText, isFinal });
      }
      
      if(isFinal) {
        if(source === 'user') userTranscriptRef.current = '';
        else aiTranscriptRef.current = '';
      }

      return newTranscripts;
    });
  }, []);

  const { startSession, endSession, pauseSession, resumeSession, sendTextMessage, muteMicrophone, unmuteMicrophone, muteSpeaker, unmuteSpeaker } = useLiveSession({
    onUpdate: handleUpdate,
    onStateChange: handleStateChange,
    onError: handleError,
    language: language,
    isSpeakerMuted: isSpeakerMuted,
  });

  const handleTogglePause = () => {
    if (interviewState === InterviewState.IN_PROGRESS) {
      pauseSession();
    } else if (interviewState === InterviewState.PAUSED) {
      resumeSession();
    }
  };

  const handleToggleMicrophoneMute = () => {
      setIsMicrophoneMuted(prev => {
        const isNowMuted = !prev;
        if(isNowMuted) {
          muteMicrophone();
        } else {
          unmuteMicrophone();
        }
        return isNowMuted;
      });
  };

  const handleToggleSpeakerMute = () => {
    setIsSpeakerMuted(prev => {
      const isNowMuted = !prev;
      if(isNowMuted) {
        muteSpeaker();
      } else {
        unmuteSpeaker();
      }
      return isNowMuted;
    });
  };

  const handleSwitchToText = () => {
    if (!isMicrophoneMuted) {
      muteMicrophone();
      setIsMicrophoneMuted(true);
    }
    setInputMode('text');
  };

  const handleSwitchToVoice = () => {
    if (isMicrophoneMuted) {
      unmuteMicrophone();
      setIsMicrophoneMuted(false);
    }
    setInputMode('voice');
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (interviewState === InterviewState.PAUSED) return;
    const trimmedText = textInputValue.trim();
    if (trimmedText) {
      handleUpdate(trimmedText, true, 'user');
      sendTextMessage(trimmedText);
      setTextInputValue('');
    }
  };


  const renderContent = () => {
    if (interviewState === InterviewState.ERROR) {
      if (errorMessage && (errorMessage.includes('Resource has been exhausted') || errorMessage.includes('quota'))) {
        return <QuotaErrorScreen T={T} />;
      }
      return <div className="text-center p-8 text-red-500">{errorMessage || T.errorText}</div>;
    }
    if (interviewState === InterviewState.FINISHED) {
      return <div className="text-center p-8 text-green-500 text-lg font-semibold">{T.finishedText}</div>;
    }

    if (interviewState === InterviewState.NOT_STARTED) {
      return <WelcomeScreen onStart={startSession} state={interviewState} T={T} />;
    }
    
    if (interviewState === InterviewState.STARTING) {
        return <LoadingScreen T={T} />;
    }

    return <InterviewScreen
      transcripts={transcripts}
      state={interviewState}
      isMicrophoneMuted={isMicrophoneMuted}
      isSpeakerMuted={isSpeakerMuted}
      onTogglePause={handleTogglePause}
      onToggleMicrophoneMute={handleToggleMicrophoneMute}
      onToggleSpeakerMute={handleToggleSpeakerMute}
      T={T}
      inputMode={inputMode}
      onSwitchToText={handleSwitchToText}
      onSwitchToVoice={handleSwitchToVoice}
      onSendText={handleSendText}
      textInputValue={textInputValue}
      onTextInputChange={(e) => setTextInputValue(e.target.value)}
      />;
  };

  return (
    <div className="flex flex-col items-center h-screen bg-gray-100 font-sans">
      <Header T={T} />
      <main className="container mx-auto max-w-4xl flex-grow w-full p-4 md:p-8 min-h-0">
        <div className="bg-white rounded-xl shadow-lg h-full overflow-hidden flex flex-col">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;