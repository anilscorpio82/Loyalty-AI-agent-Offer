"use client";
import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, XCircle } from 'lucide-react';

export default function PrivacySettings({ user, onChange }: { user: any, onChange: (u: any) => void }) {
  const [trackingOptIn, setTrackingOptIn] = useState(false);
  const [locationOptIn, setLocationOptIn] = useState(false);
  const [aiOptIn, setAiOptIn] = useState(false);

  useEffect(() => {
    if (user) {
      setTrackingOptIn(user.trackingOptIn);
      setLocationOptIn(user.locationOptIn);
      setAiOptIn(user.aiOptIn);
    }
  }, [user]);

  const handleSave = async () => {
    const response = await fetch('http://localhost:3001/api/users/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousId: user?.anonymousId || 'anon_12345',
        trackingOptIn,
        locationOptIn,
        aiOptIn
      })
    });
    const updatedUser = await response.json();
    onChange(updatedUser);
  };

  const handleEraseData = async () => {
      if(!user?.anonymousId) return;
      if(confirm('Are you sure? This will erase all your history and preferences (GDPR Right to Erasure).')) {
          await fetch(`http://localhost:3001/api/users/${user.anonymousId}`, {
             method: 'DELETE'
          });
          onChange(null); // Clear session
      }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">Privacy & Consent (GDPR)</h2>
      </div>
      
      <p className="text-sm text-gray-600 mb-6">
        We value your privacy. Your data is anonymized and never sold. Please adjust your preferences below.
      </p>

      <div className="space-y-4">
        <label className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
          <div>
             <span className="font-semibold text-gray-800 block">Personalized Offers (AI)</span>
             <span className="text-xs text-gray-500">Allow AI to suggest complementary offers based on your point balance.</span>
          </div>
          <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={aiOptIn} onChange={(e) => setAiOptIn(e.target.checked)} />
        </label>
        
        <label className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
          <div>
            <span className="font-semibold text-gray-800 block">Location Services</span>
            <span className="text-xs text-gray-500">Allow us to securely check near-by geofences for partner offers.</span>
          </div>
          <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={locationOptIn} onChange={(e) => setLocationOptIn(e.target.checked)} />
        </label>
        
        <label className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
           <div>
            <span className="font-semibold text-gray-800 block">Behavioral Analytics</span>
            <span className="text-xs text-gray-500">Help us improve by tracking which offers you compare and view.</span>
           </div>
          <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={trackingOptIn} onChange={(e) => setTrackingOptIn(e.target.checked)} />
        </label>
      </div>

      <div className="mt-6 flex gap-4">
        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium transition-colors">
          Save Preferences
        </button>
        <button onClick={handleEraseData} className="border border-red-200 text-red-600 px-4 py-2 rounded-md hover:bg-red-50 font-medium transition-colors">
          Erase My Data
        </button>
      </div>
    </div>
  );
}
