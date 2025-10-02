/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

type Message = {
  id: number;
  sender: 'user' | 'bot';
  text?: string;
  imageUrl?: string;
  isLoading?: boolean;
  error?: string;
  action?: {
    text: string;
    url: string;
  };
};

const App = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('طبيعي');
  const [isStylePickerOpen, setIsStylePickerOpen] = useState(false);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const stylePickerRef = useRef<HTMLDivElement>(null);

  const styles = ['نيون', 'بورتريه', 'طبيعي', 'واقعي', 'سينمائي', 'ثلاثي الأبعاد', 'دعم'];
  const styleMap: { [key: string]: string } = {
    'نيون': 'Neon style',
    'بورتريه': 'Portrait style',
    'طبيعي': 'Natural style',
    'واقعي': 'Photorealistic style',
    'سينمائي': 'Cinematic style',
    'ثلاثي الأبعاد': '3D render style',
    'دعم': 'Support',
  };

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (stylePickerRef.current && !stylePickerRef.current.contains(event.target as Node)) {
        setIsStylePickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [stylePickerRef]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Handle download command
    if (trimmedInput === 'تنزيل صوره سابقه') {
      const lastImageMessage = [...messages].reverse().find(msg => msg.imageUrl);
      
      if (lastImageMessage && lastImageMessage.imageUrl) {
        const link = document.createElement('a');
        link.href = lastImageMessage.imageUrl;
        link.download = `rlo-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const noImageMessage: Message = {
          id: Date.now() + 1,
          sender: 'bot',
          text: 'لم يتم العثور على صورة سابقة لتنزيلها.',
        };
        setMessages(prev => [...prev, noImageMessage]);
      }
      setInput('');
      return;
    }


    const userMessage: Message = { id: Date.now(), sender: 'user', text: trimmedInput };
    
    // Handle support mode separately
    if (selectedStyle === 'دعم') {
      const botSupportMessage: Message = {
        id: Date.now() + 1,
        sender: 'bot',
        text: 'لو في مشكله تواصل معنا مباشر عبر رقم ده علي واتس اب.',
        action: {
          text: 'تواصل عبر واتساب',
          url: 'https://wa.me/201207015649'
        }
      };
      setMessages(prev => [...prev, userMessage, botSupportMessage]);
      setInput('');
      return;
    }

    const botMessageId = Date.now() + 1;
    const botLoadingMessage: Message = { id: botMessageId, sender: 'bot', isLoading: true };

    setMessages(prev => [...prev, userMessage, botLoadingMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const fullPrompt = `${styleMap[selectedStyle]}, ${trimmedInput}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [{ text: fullPrompt }] },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      let imageUrl: string | undefined;
      let error: string | undefined;

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64ImageBytes: string = part.inlineData.data;
          imageUrl = `data:image/png;base64,${base64ImageBytes}`;
          break;
        }
      }

      if (!imageUrl) {
        error = "لم أتمكن من إنشاء صورة. حاول مرة أخرى بوصف مختلف.";
      }

      setMessages(prev => prev.map(msg =>
        msg.id === botMessageId ? { ...msg, isLoading: false, imageUrl, error } : msg
      ));

    } catch (err) {
      console.error(err);
      setMessages(prev => prev.map(msg =>
        msg.id === botMessageId ? { ...msg, isLoading: false, error: 'حدث خطأ ما. يرجى المحاولة مرة أخرى.' } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>RLO</h1>
      </header>

      <div className="chat-history" ref={chatHistoryRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.sender}`}>
            <div className={`bubble ${msg.imageUrl ? 'image-bubble' : ''}`}>
              {msg.isLoading ? (
                <div className="loader-bubble">
                  <div className="spinner"></div>
                  <span>...جاري الإنشاء</span>
                </div>
              ) : msg.error ? (
                <span>{msg.error}</span>
              ) : msg.imageUrl ? (
                <img src={msg.imageUrl} alt="Generated image" />
              ) : (
                <div className="text-content">
                  <span>{msg.text}</span>
                  {msg.action && (
                    <a
                      href={msg.action.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="action-btn"
                    >
                      {msg.action.text}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form className="chat-input-form" onSubmit={handleSend}>
        <button type="submit" className="send-btn" disabled={isLoading} aria-label="Send prompt">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
        </button>
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب وصفًا للصورة..."
          disabled={isLoading}
          aria-label="Image description"
        />
        <div className="style-picker-container" ref={stylePickerRef}>
          <button
            type="button"
            className="style-picker-btn"
            onClick={() => setIsStylePickerOpen(!isStylePickerOpen)}
            aria-label="Select style"
            aria-haspopup="true"
            aria-expanded={isStylePickerOpen}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.64-.11 2.42-.31.81 1.47 2.39 2.53 4.25 2.53 2.76 0 5-2.24 5-5 0-1.86-1.06-3.44-2.53-4.25.2-.78.31-1.59.31-2.42C21 7.03 16.97 3 12 3zm6.5 13.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM12 7c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zM5.5 12c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5S5.5 13.38 5.5 12z"></path></svg>
            <span className="selected-style-label">{selectedStyle}</span>
          </button>
          <div className={`style-picker-menu ${isStylePickerOpen ? 'open' : ''}`}>
            {styles.map(style => (
              <button
                type="button"
                key={style}
                className={`style-btn ${selectedStyle === style ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedStyle(style);
                  setIsStylePickerOpen(false);
                }}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
      </form>
      
      <footer>
        هذه نسخه تجريبيه
      </footer>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);