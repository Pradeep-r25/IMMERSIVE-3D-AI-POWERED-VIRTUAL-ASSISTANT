import { useRef, useEffect, useState } from "react";
import { useChat } from "../hooks/useChat";

export const UI = ({ hidden }) => {
  const input = useRef();
  const { chat, loading, cameraZoomed, setCameraZoomed, message } = useChat();
  const [isListening, setIsListening] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  let recognition = null;
  if ("webkitSpeechRecognition" in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
  }

  const sendMessage = () => {
    const text = input.current.value.trim();
    if (text && !loading && !message) {
      setChatHistory((prev) => [...prev, { text, sender: "user" }]);
      chat(text);
      input.current.value = "";
    }
  };

  useEffect(() => {
    if (message) {
      setChatHistory((prev) => [...prev, { text: message.text, sender: "ai" }]);
    }
  }, [message]);

  const startListening = () => {
    if (!recognition) {
      alert("Your browser does not support speech recognition.");
      return;
    }
  
    setIsListening(true);
    let finalTranscript = "";
    let silenceTimer;
  
    recognition.continuous = true; // Allow longer speech
    recognition.start();
  
    recognition.onresult = (event) => {
      clearTimeout(silenceTimer); // reset silence timer on every result
  
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }
  
      input.current.value = finalTranscript + interim;
  
      // Start 5s silence timer after last word
      silenceTimer = setTimeout(() => {
        recognition.stop();
        input.current.value = finalTranscript.trim(); // Final cleanup
        sendMessage();
      }, 5000);
    };
  
    recognition.onerror = () => {
      clearTimeout(silenceTimer);
      setIsListening(false);
    };
  
    recognition.onend = () => {
      clearTimeout(silenceTimer);
      setIsListening(false);
    };
  };
  

  if (hidden) return null;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 bottom-0 z-10 flex flex-col p-4 pointer-events-none">
        {/* Header */}
        <div className="self-start backdrop-blur-md bg-white bg-opacity-50 p-4 rounded-lg">
          <h1 className="font-black text-xl">3D AI Assistant</h1>
        </div>

        {/* Chat Messages */}
        <div className="flex flex-col gap-2 p-4 overflow-y-auto flex-grow pointer-events-auto">
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg max-w-xs ${
                msg.sender === "user"
                  ? "bg-blue-500 text-white self-end"
                  : "bg-gray-200 text-black self-start"
              }`}
            >
              {msg.text}
            </div>
          ))}
          {loading && (
            <div className="p-3 rounded-lg bg-gray-200 text-black self-start">
              Typing...
            </div>
          )}
        </div>

        {/* Zoom In / Out Button */}
        <div className="flex justify-end mb-4 pointer-events-auto">
          <button
            onClick={() => setCameraZoomed(!cameraZoomed)}
            className="bg-pink-500 hover:bg-pink-600 text-white p-3 rounded-md"
          >
            {cameraZoomed ? "Zoom Out 🔍-" : "Zoom In 🔍+"}
          </button>
        </div>

        {/* Input + Controls */}
        <div className="flex items-center gap-2 pointer-events-auto max-w-screen-sm w-full mx-auto">
          <input
            ref={input}
            className="w-full placeholder:text-gray-800 placeholder:italic p-4 rounded-md bg-opacity-50 bg-white backdrop-blur-md"
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            onClick={startListening}
            disabled={isListening || loading || message}
            className={`bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-md ${
              isListening ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            🎤
          </button>
          <button
            onClick={sendMessage}
            disabled={loading || message}
            className={`bg-pink-500 hover:bg-pink-600 text-white p-4 px-10 font-semibold uppercase rounded-md ${
              loading || message ? "cursor-not-allowed opacity-30" : ""
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
};
