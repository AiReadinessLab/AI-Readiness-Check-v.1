import React, { useState, useCallback, useRef, useEffect } from 'react';
import { InterviewState, Transcript, Language } from './types';
import { useLiveSession } from './hooks/useLiveSession';

const UI_STRINGS = {
  en: {
    headerTitle: "AI Readiness Check",
    headerSubtitle: "Your personal AI readiness assessor",
    welcomeTitle: "Welcome!",
    welcomeText: "Click the microphone button below to start your AI Readiness Check. The conversation will be conducted via voice.",
    startCheck: "Start Check",
    connecting: "Connecting...",
    connectingText: "The AI assistant is preparing your check. This will just take a moment.",
    statusInProgress: "Check in progress...",
    statusPaused: "Check paused. Click the mic to resume.",
    statusEnding: "Ending check...",
    endCheck: "End Check",
    errorText: "An error occurred. Please refresh and try again.",
    finishedText: "Check Finished. Thank you!",
    pauseCheckAria: "Pause Check",
    resumeCheckAria: "Resume Check",
  },
  de: {
    headerTitle: "KI-Bereitschafts-Check",
    headerSubtitle: "Ihr persönlicher Assessor für KI-Bereitschaft",
    welcomeTitle: "Willkommen!",
    welcomeText: "Klicken Sie auf den Mikrofon-Button, um Ihren KI-Bereitschafts-Check zu starten. Das Gespräch wird per Sprache geführt.",
    startCheck: "Check starten",
    connecting: "Verbinde...",
    connectingText: "Der KI-Assistent bereitet Ihren Check vor. Dies dauert nur einen Moment.",
    statusInProgress: "Check läuft...",
    statusPaused: "Check pausiert. Klicken Sie zum Fortfahren auf das Mikrofon.",
    statusEnding: "Check wird beendet...",
    endCheck: "Check beenden",
    errorText: "Ein Fehler ist aufgetreten. Bitte laden Sie die Seite neu und versuchen Sie es erneut.",
    finishedText: "Check beendet. Vielen Dank!",
    pauseCheckAria: "Check pausieren",
    resumeCheckAria: "Check fortsetzen",
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
      <MicButton onClick={onStart} state={state} T={T} />
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


const InterviewScreen: React.FC<{ transcripts: Transcript[]; state: InterviewState; onTogglePause: () => void; onStop: () => void; T: typeof UI_STRINGS['en'] }> = ({ transcripts, state, onTogglePause, onStop, T }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);
  
  const getStatusText = () => {
    switch (state) {
        case InterviewState.IN_PROGRESS:
            return T.statusInProgress;
        case InterviewState.PAUSED:
            return T.statusPaused;
        case InterviewState.ENDING:
            return T.statusEnding;
        default:
            return "";
    }
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div ref={scrollRef} className="flex-grow p-6 overflow-y-auto space-y-6">
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
      <div className="p-8 border-t border-gray-200 bg-white flex flex-col items-center">
        <MicButton onClick={onTogglePause} state={state} T={T} />
        <p className="mt-4 text-gray-700 font-medium h-6">
            {getStatusText()}
        </p>
        {(state === InterviewState.IN_PROGRESS || state === InterviewState.PAUSED) &&
             <button onClick={onStop} className="mt-2 text-sm font-semibold text-gray-500 hover:text-red-600 transition-colors">
                 {T.endCheck}
             </button>
        }
      </div>
    </div>
  );
};


const MicButton: React.FC<{ onClick: () => void; state: InterviewState, T: typeof UI_STRINGS['en'] }> = ({ onClick, state, T }) => {
  const isStarting = state === InterviewState.STARTING;
  const isDisabled = isStarting || state === InterviewState.ENDING || state === InterviewState.FINISHED || state === InterviewState.ERROR;

  const getAppearance = () => {
    switch (state) {
      case InterviewState.NOT_STARTED:
        return { icon: 'fa-microphone', color: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300', pulse: false };
      case InterviewState.STARTING:
        return { icon: 'fa-microphone', color: 'bg-gray-400 cursor-not-allowed', pulse: true };
      case InterviewState.IN_PROGRESS:
        return { icon: 'fa-pause', color: 'bg-red-500 hover:bg-red-600 focus:ring-red-300', pulse: true };
      case InterviewState.PAUSED:
        return { icon: 'fa-microphone', color: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300', pulse: false };
      default: // ENDING, FINISHED, ERROR
        return { icon: 'fa-microphone', color: 'bg-gray-400 cursor-not-allowed', pulse: false };
    }
  };

  const { icon, color, pulse } = getAppearance();

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-4 focus:ring-opacity-50 text-white ${color} ${pulse ? 'animate-pulse' : ''}`}
      aria-label={state === InterviewState.IN_PROGRESS ? T.pauseCheckAria : T.resumeCheckAria}
    >
      <i className={`fa-solid ${icon} text-3xl`}></i>
    </button>
  );
};

const App: React.FC = () => {
  const [interviewState, setInterviewState] = useState<InterviewState>(InterviewState.NOT_STARTED);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [language, setLanguage] = useState<Language>('en');
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

  const handleStateChange = useCallback((newState: InterviewState) => {
    setInterviewState(newState);
    if (newState === InterviewState.FINISHED || newState === InterviewState.ERROR) {
      // Reset for a potential new session
      setTimeout(() => {
        setTranscripts([]);
        setInterviewState(InterviewState.NOT_STARTED);
      }, 3000);
    }
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

      // Finalize the last AI turn if user starts speaking
      if (source === 'user' && last && last.source === 'ai' && !last.isFinal) {
        last.isFinal = true;
      }
      // Finalize the last User turn if AI starts speaking
      if (source === 'ai' && last && last.source === 'user' && !last.isFinal) {
        last.isFinal = true;
      }

      const currentText = source === 'user' ? userTranscriptRef.current : aiTranscriptRef.current;
      
      if (last && last.source === source && !last.isFinal) {
        last.text = currentText;
        last.isFinal = isFinal;
      } else if (currentText) { // Avoid adding empty transcripts
        newTranscripts.push({ source, text: currentText, isFinal });
      }
      
      if(isFinal) {
        if(source === 'user') userTranscriptRef.current = '';
        else aiTranscriptRef.current = '';
      }

      return newTranscripts;
    });
  }, []);

  const { startSession, endSession, pauseSession, resumeSession } = useLiveSession({
    onUpdate: handleUpdate,
    onStateChange: handleStateChange,
    language: language,
  });

  const handleTogglePause = () => {
    if (interviewState === InterviewState.IN_PROGRESS) {
      pauseSession();
    } else if (interviewState === InterviewState.PAUSED) {
      resumeSession();
    }
  };

  const renderContent = () => {
    if (interviewState === InterviewState.ERROR) {
      return <div className="text-center p-8 text-red-500">{T.errorText}</div>;
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

    return <InterviewScreen transcripts={transcripts} state={interviewState} onTogglePause={handleTogglePause} onStop={endSession} T={T} />;
  };

  return (
    <div className="flex flex-col items-center h-screen bg-gray-100 font-sans">
      <Header T={T} />
      <main className="container mx-auto max-w-4xl flex-grow w-full p-4 md:p-8">
        <div className="bg-white rounded-xl shadow-lg h-full overflow-hidden flex flex-col">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
