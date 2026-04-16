import { useState, useEffect, useRef } from 'react';
import { LuX } from 'react-icons/lu';

type ChatMessage = { role: 'assistant' | 'user'; text: string };
type FaqMatcherEntry = { keywords: string[]; answer: string };

const DUMMY_CHATBOT_GREETING = 'Guten Tag! Ich bin der Chatbot vom Kanton Luzern. Ich unterstütze Sie bei Fragen im Zusammenhang mit dem Objektwesen.\nDa ich noch lerne, ist es möglich, dass ich nicht jede Frage korrekt beantworten kann.\nWie kann ich Ihnen helfen?';

export const faqMatcher: FaqMatcherEntry[] = [
  {
    keywords: ['funktioniert', 'wie funktioniert', 'erklarung', 'was ist das', 'wie lauft das'],
    answer: 'Diese Anwendung zeigt geografische Daten auf einer interaktiven Karte. Klicken Sie auf ein Grundstück, um Informationen dazu zu erhalten.'
  },
  {
    keywords: ['hallo', 'hi', 'hey', 'guten tag'],
    answer: 'Hallo 🙂 Wie kann ich Ihnen helfen?'
  },
  {
    keywords: ['wie geht', 'wie geht es dir', 'alles gut'],
    answer: 'Danke 🙂 Ich bin ein Demo-Chatbot und jederzeit bereit zu helfen.'
  },
  {
    keywords: ['wer bist du', 'was bist du', 'bot', 'chatbot'],
    answer: 'Ich bin ein einfacher Chatbot und helfe Ihnen bei Fragen zu dieser Kartenanwendung.'
  },
  {
    keywords: ['wer steckt dahinter', 'entwickler', 'firma', 'anbieter'],
    answer: 'Diese Anwendung ist ein Prototyp und wurde zu Demonstrationszwecken entwickelt.'
  },
  {
    keywords: ['geo luzern', 'kanton luzern geo', 'geodaten luzern'],
    answer: 'Die Geoinformation des Kantons Luzern stellt geografische Daten wie Grundstücke, Karten und Luftbilder bereit.'
  },
  {
    keywords: ['wie bedienen', 'bedienung', 'wie nutzen', 'anleitung'],
    answer: 'Sie können die Karte bewegen, zoomen und auf Grundstücke klicken, um Informationen zu erhalten.'
  },
  {
    keywords: ['hilfe', 'support', 'kontakt', 'wer hilft'],
    answer: 'Bitte wenden Sie sich an die zuständige Fachstelle oder den Betreiber der Anwendung.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Gerne helfe ich weiter. Stellen Sie mir einfach Ihre Frage zum Objektwesen oder zur Kartenanwendung.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich bin für Sie da. Beschreiben Sie kurz Ihr Anliegen, dann versuche ich zu helfen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Natürlich. Sie können mir eine Frage zu Grundstücken, Daten oder zur Bedienung der Karte stellen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Wenn etwas unklar ist, fragen Sie mich einfach. Ich unterstütze Sie gerne im Rahmen dieser Demo.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich kann Ihnen allgemeine Hinweise zur Anwendung und zu den angezeigten Grundstücksdaten geben.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Teilen Sie mir bitte mit, wobei Sie Unterstützung benötigen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Sie können mich beispielsweise zur Karte, zu Parzellen oder zur Nutzung der Anwendung befragen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Gerne. Ich beantworte einfache Fragen zur Demo-Anwendung so gut ich kann.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Bitte formulieren Sie Ihre Frage möglichst konkret, damit ich besser unterstützen kann.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich helfe Ihnen gerne beim Verständnis der Kartenansicht und der Grundstücksinformationen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Wenn Sie möchten, können Sie direkt eine Frage zu einem Grundstück oder zu den Daten stellen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich bin ein Demo-Chatbot und gebe Ihnen gerne eine erste Orientierung.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Fragen Sie mich ruhig – ich versuche, verständlich und kurz zu antworten.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich kann Ihnen erklären, wie die Anwendung funktioniert und welche Informationen angezeigt werden.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Falls Sie Unterstützung brauchen, schreiben Sie einfach Ihr Anliegen in einem Satz.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Gerne unterstütze ich Sie bei allgemeinen Fragen zum Objektwesen und zur Kartenbedienung.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Sie dürfen mir jederzeit eine neue Frage stellen, wenn etwas unklar geblieben ist.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich bin zwar noch in der Demo-Phase, aber ich versuche, nützliche Hinweise zu geben.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Wobei darf ich Sie aktuell unterstützen?'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Sie können mich nach der Bedeutung von Datenfeldern oder nach der Bedienung fragen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich unterstütze Sie gerne bei ersten Fragen rund um diese Demo des Kantons Luzern.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Wenn Sie möchten, beginnen Sie mit einer kurzen Frage wie zum Beispiel: Was zeigt diese Karte?'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich kann Ihnen bei der Orientierung in der Anwendung eine erste Hilfestellung geben.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Schreiben Sie mir einfach, was Sie wissen möchten.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich beantworte gern allgemeine Fragen zu Karte, Grundstücken und verfügbaren Informationen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Wenn Sie Hilfe brauchen, formuliere ich auch gerne eine kurze Erklärung zur Anwendung.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich kann Ihnen eine erste Auskunft geben – für verbindliche Angaben wenden Sie sich bitte an die zuständige Stelle.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Probieren Sie es einfach mit einer konkreten Frage, ich antworte so gut wie möglich.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich bin bereit. Welche Information suchen Sie?'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Bei Unsicherheiten zur Nutzung der Anwendung können Sie mich jederzeit ansprechen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich unterstütze Sie gerne mit allgemeinen Antworten rund um diese Kartenanwendung.'
  },
  {
    keywords: ['daten', 'woher daten', 'quelle', 'herkunft'],
    answer: 'Die Daten stammen aus offiziellen Geodiensten des Kantons Luzern.'
  },
  {
    keywords: ['kosten', 'gratis', 'preis', 'bezahlen'],
    answer: 'Diese Demo-Anwendung ist kostenlos nutzbar.'
  },
  {
    keywords: ['grundstuck', 'parzelle', 'land', 'flache'],
    answer: 'Ein Grundstück ist eine abgegrenzte Fläche Land mit eigener Nummer und Nutzung.'
  },
  {
    keywords: ['karte', 'map', 'ansicht', 'layer', 'karteninhalt'],
    answer: 'Die Karte zeigt geografische Informationen und dient zur Navigation und Analyse.'
  },
  {
    keywords: ['zoom', 'vergrossern', 'verkleinern'],
    answer: 'Sie können mit dem Mausrad oder Touch-Gesten hinein- und herauszoomen.'
  },
  {
    keywords: ['klicken', 'auswahlen', 'antippen'],
    answer: 'Klicken Sie auf ein Grundstück, um Details dazu anzuzeigen.'
  },
  {
    keywords: ['fehler', 'geht nicht', 'problem', 'bug'],
    answer: 'Es scheint ein Problem zu geben. Bitte laden Sie die Seite neu oder versuchen Sie es später erneut.'
  },
  {
    keywords: ['mobile', 'handy', 'smartphone'],
    answer: 'Die Anwendung funktioniert auch auf mobilen Geräten mit Touch-Bedienung.'
  },
  {
    keywords: ['browser', 'chrome', 'firefox', 'safari'],
    answer: 'Die Anwendung läuft in modernen Webbrowsern wie Chrome, Firefox oder Safari.'
  },
  {
    keywords: ['genauigkeit', 'prazision', 'wie genau'],
    answer: 'Die Genauigkeit hängt von den zugrunde liegenden Geodaten ab und kann variieren.'
  },
  {
    keywords: ['aktualitat', 'update', 'wie aktuell'],
    answer: 'Die Daten werden regelmässig aktualisiert, jedoch kann es zu Verzögerungen kommen.'
  },
  {
    keywords: ['mehr infos', 'details', 'weitere infos'],
    answer: 'Weitere Informationen sind in einer erweiterten Version oder bei den offiziellen Stellen verfügbar.'
  },
];

function normalizeChatText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function questionMatchesKeyword(normalizedQuestion: string, questionWords: string[], keyword: string): boolean {
  const normalizedKeyword = normalizeChatText(keyword).trim();
  if (!normalizedKeyword) return false;
  if (normalizedKeyword.includes(' ')) return normalizedQuestion.includes(normalizedKeyword);
  return questionWords.includes(normalizedKeyword);
}

function getFaqAnswer(question: string, previousAnswer?: string | null): string {
  const normalizedQuestion = normalizeChatText(question);
  const questionWords = normalizedQuestion.split(/[^a-z0-9]+/).filter(Boolean);

  const matchingAnswers = faqMatcher
    .filter(entry => entry.keywords.some(keyword => questionMatchesKeyword(normalizedQuestion, questionWords, keyword)))
    .map(entry => entry.answer);

  if (matchingAnswers.length === 0) {
    return 'Danke für Ihre Nachricht. Dies ist aktuell ein Dummy-Chatbot des Kantons Luzern und dient nur zur Demo.';
  }

  const uniqueAnswers = Array.from(new Set(matchingAnswers));
  const answerPool = previousAnswer && uniqueAnswers.length > 1
    ? uniqueAnswers.filter(answer => answer !== previousAnswer)
    : uniqueAnswers;

  return answerPool[Math.floor(Math.random() * answerPool.length)];
}

function LuzernChatFabIcon({ size = 28, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path
        d="M9 7.5h14A4.5 4.5 0 0 1 27.5 12v6A4.5 4.5 0 0 1 23 22.5h-4.6L12 27v-4.5H9A4.5 4.5 0 0 1 4.5 18v-6A4.5 4.5 0 0 1 9 7.5Z"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 13h10M11 16.5h7" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function DummyChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [lastFaqAnswer, setLastFaqAnswer] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: DUMMY_CHATBOT_GREETING },
  ]);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [open, messages]);

  const handleSend = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const answer = getFaqAnswer(text, lastFaqAnswer);

    setMessages(prev => [
      ...prev,
      { role: 'user', text },
      { role: 'assistant', text: answer },
    ]);
    setLastFaqAnswer(answer);
    setDraft('');
  };

  return (
    <>
      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-panel__header">
            <span className="chatbot-panel__title">
              <LuzernChatFabIcon size={18} />
              Chatbot Kanton Luzern
            </span>
            <button
              onClick={() => setOpen(false)}
              className="chatbot-panel__close"
              aria-label="Chatbot schliessen"
            >
              <LuX size={18} />
            </button>
          </div>

          <div ref={messagesRef} className="chatbot-messages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`chatbot-message ${message.role === 'user' ? 'chatbot-message--user' : 'chatbot-message--assistant'}`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="chatbot-form">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Frage eingeben …"
              className="chatbot-input"
            />
            <button type="submit" className="chatbot-submit">
              Senden
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen(value => !value)}
        aria-label={open ? 'Chatbot schliessen' : 'Chatbot öffnen'}
        title="Chatbot"
        className="chatbot-fab"
      >
        <LuzernChatFabIcon size={36} />
      </button>
    </>
  );
}
