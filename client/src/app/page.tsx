"use client";

import React, { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import dynamic from 'next/dynamic';

const DynamicBoard = dynamic(() => import('@/components/DynamicBoard'), {
  ssr: false,
});

export default function Home() {
  const [widgets, setWidgets] = useState<any[]>([]);

  const handleNewWidget = (widgetData: any) => {
    // Generate a unique ID for the widget to allow closing it
    const newWidget = {
      id: Date.now().toString() + Math.random().toString(),
      data: widgetData
    };
    // Append to board
    setWidgets(prev => [newWidget, ...prev]);
  };

  const removeWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  return (
    <main style={{ display: 'flex', height: '100vh', padding: '24px', gap: '24px' }}>

      {/* Left Sidebar: Chat Interface */}
      <section style={{ width: '400px', minWidth: '400px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <ChatInterface onNewWidget={handleNewWidget} />
      </section>

      {/* Main Area: Dynamic Board */}
      <section style={{ flex: 1, height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
        <DynamicBoard widgets={widgets} onRemoveWidget={removeWidget} />
      </section>

    </main>
  );
}
