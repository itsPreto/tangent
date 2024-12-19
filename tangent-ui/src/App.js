import React from 'react';
import { IntegratedDashboard } from './components//layout/IntegratedDashboard';
import VisualizationProvider from './components/providers/VisualizationProvider';
import OnboardingTour from './components/overlay/OnboardingTour';


import './styles/Global.css';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <VisualizationProvider>
        <OnboardingTour />
        <IntegratedDashboard />
      </VisualizationProvider>
    </div>
  );
}

export default App;