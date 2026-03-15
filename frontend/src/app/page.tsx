"use client";
import React, { useState } from 'react';
import { Send, MapPin, Search, ShieldCheck } from 'lucide-react';
import PrivacySettings from '@/components/PrivacySettings';
import { useSession, signIn, signOut } from "next-auth/react";

export default function Home() {
  const [messages, setMessages] = useState([
    { role: 'agent', content: 'Hello! I am your secure Loyalty Offers Agent. How can I help you maximize your points today?' }
  ]);
  const [input, setInput] = useState('');
  const [userSettings, setUserSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { data: session, status } = useSession();

  const simulateCall = async (text: string) => {
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);
    
    // Simulate Analytics Event
    if (userSettings?.trackingOptIn) {
      await fetch('http://localhost:3001/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSettings.id, eventType: 'CHAT_MESSAGE', eventData: null })
      });
    }

    // Fetch Real LLM Response (Streaming)
    try {
      const chatRes = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           anonymousId: (session?.user as any)?.id || userSettings?.anonymousId || 'anon_12345',
           message: text
        })
      });

      if (!chatRes.ok || !chatRes.body) throw new Error("Stream Failed");

      // Add empty agent message that we will fill up over time
      setMessages(prev => [...prev, { role: 'agent', content: '' }]);

      const reader = chatRes.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let done = false;
      while (!done) {
         const { value, done: doneReading } = await reader.read();
         done = doneReading;
         if (value) {
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '');
                    if (dataStr === '[DONE]') break;
                    
                    try {
                       const parsed = JSON.parse(dataStr);
                       // Update the LAST message with the new chunk
                       setMessages(prev => {
                          const newMessages = [...prev];
                          const lastIdx = newMessages.length - 1;
                          newMessages[lastIdx] = {
                             ...newMessages[lastIdx],
                             content: newMessages[lastIdx].content + (parsed.text || "")
                          };
                          return newMessages;
                       });
                    } catch(e) { /* ignore JSON parse errors for split chunks */ }
                }
            }
         }
      }

    } catch (err) {
      setMessages(prev => [...prev, { role: 'agent', content: "Connection to securely vaulted AI failed." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
      return <div className="flex h-screen items-center justify-center bg-gray-50"><p>Loading Identity...</p></div>;
  }

  if (!session) {
      return (
         <div className="flex h-screen flex-col items-center justify-center bg-gray-50">
             <ShieldCheck className="w-16 h-16 text-blue-600 mb-4" />
             <h1 className="text-3xl font-bold mb-2">Loyalty Offers Agent</h1>
             <p className="text-gray-600 mb-8 max-w-md text-center">
                To provide you with secure, personalized Next Best Offers, please authenticate.
             </p>
             <button 
                 onClick={() => signIn()} 
                 className="bg-blue-600 font-semibold px-8 py-3 rounded-lg text-white hover:bg-blue-700 transition"
             >
                 Secure Login
             </button>
         </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
         <div>
            <h1 className="text-2xl font-black tracking-tight text-blue-900">Loyalty<span className="text-blue-500">AI</span></h1>
            <p className="text-sm text-gray-500">PCI/GDPR Compliant Offers Agent</p>
         </div>
         <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700 font-medium whitespace-nowrap hidden sm:inline-block">Logged in as {session.user?.name}</span>
            <button onClick={() => signOut()} className="text-xs text-red-600 hover:text-red-800 font-semibold bg-red-50 px-3 py-1 rounded border border-red-200">Sign Out</button>
         </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 flex flex-col gap-6 h-[calc(100vh-80px)]">
         {/* Consent Banner / Settings */}
         <PrivacySettings user={userSettings} onChange={setUserSettings} />
         
         {/* Chat Interface */}
         <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-100 flex flex-col overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100 text-sm font-semibold flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               Agent Service Connected (Secure Mode)
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
              {messages.map((msg, i) => (
                <div key={i} className={`max-w-[75%] p-4 rounded-xl shadow-sm ${msg.role === 'agent' ? 'bg-blue-50 text-blue-900 self-start rounded-tl-none' : 'bg-blue-600 text-white self-end rounded-tr-none'}`}>
                  {msg.content}
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-white border-t border-gray-100">
               <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); simulateCall(input); }}>
                 <button type="button" className="p-3 text-gray-400 hover:text-blue-600 transition-colors bg-gray-50 rounded-lg border border-gray-200" title="Find near me" onClick={() => simulateCall("What offers are near me?")}>
                    <MapPin className="w-5 h-5"/>
                 </button>
                 <button type="button" className="p-3 text-gray-400 hover:text-blue-600 transition-colors bg-gray-50 rounded-lg border border-gray-200" title="Compare" onClick={() => simulateCall("Compare my best offers")}>
                    <Search className="w-5 h-5"/>
                 </button>
                 <input 
                   type="text" 
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   className="flex-1 border border-gray-300 rounded-lg px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   placeholder="Ask me to compare offers or suggest based on points..."
                 />
                 <button type="submit" disabled={!input.trim() || isLoading} className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                   {isLoading ? <span className="animate-spin text-sm">...</span> : <Send className="w-5 h-5"/>}
                 </button>
               </form>
            </div>
         </div>
      </main>
    </div>
  );
}
