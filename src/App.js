import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [model, setModel] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [alerts, setAlerts] = useState([]); // NEW: Alert state

  // Load model on component mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const loadedModel = await cocossd.load();
        setModel(loadedModel);
        console.log('Model loaded successfully');
      } catch (error) {
        console.error('Error loading model:', error);
      }
    };
    loadModel();
  }, []);

  // NEW: Alert function
  const triggerAlert = (objectType) => {
    const alertMessage = `⚠️ ${objectType.toUpperCase()} DETECTED`;
    const newAlert = { id: Date.now(), message: alertMessage };
    setAlerts(prev => [...prev, newAlert]);
    
    // Remove alert after 2 seconds
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== newAlert.id));
    }, 2000);
    
    // Play alert sound (optional)
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(`Alert: ${objectType} detected`);
      utterance.rate = 1.5;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  // UPDATED: Detection function with alerts
  const detect = async () => {
    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null &&
      webcamRef.current.video.readyState === 4 &&
      model
    ) {
      const video = webcamRef.current.video;
      const predictions = await model.detect(video);
      
      // NEW: Check for driving hazards
      const hazards = predictions.filter(pred => 
        ['person', 'car', 'truck', 'bus', 'bicycle', 'motorcycle'].includes(pred.class)
      );
      
      // NEW: Trigger alerts for high-confidence hazards
      hazards.forEach(hazard => {
        if (hazard.score > 0.7) {
          triggerAlert(hazard.class);
        }
      });
      
      // Draw predictions on canvas
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      predictions.forEach((prediction) => {
        const [x, y, width, height] = prediction.bbox;
        
        // Draw bounding box (red for hazards, green for others)
        const isHazard = ['person', 'car', 'truck', 'bus', 'bicycle', 'motorcycle'].includes(prediction.class);
        ctx.strokeStyle = isHazard ? '#ff0000' : '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        
        // Draw label
        ctx.fillStyle = isHazard ? '#ff0000' : '#00ff00';
        ctx.font = '16px Arial';
        ctx.fillText(
          `${prediction.class} ${Math.round(prediction.score * 100)}%`,
          x,
          y > 20 ? y - 5 : y + 20
        );
      });
    }
  };

  // Start/stop detection
  const toggleDetection = () => {
    setDetecting(!detecting);
  };

  // Detection loop
  useEffect(() => {
    let interval;
    if (detecting && model) {
      interval = setInterval(detect, 100); // Detect every 100ms
    }
    return () => clearInterval(interval);
  }, [detecting, model]);

  return (
    <div className="App" style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Navae - AI Driver Assistant Demo</h1>
      
      {/* NEW: Alert Display */}
      {alerts.map(alert => (
        <div 
          key={alert.id}
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#ff4444',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            zIndex: 1000,
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
          }}
        >
          {alert.message}
        </div>
      ))}
      
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <Webcam
          ref={webcamRef}
          mirrored={false}
          style={{
            width: '100%',
            maxWidth: '640px',
            height: 'auto',
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={toggleDetection}
          disabled={!model}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            backgroundColor: detecting ? '#ff4444' : '#44ff44',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {!model ? 'Loading Model...' : detecting ? 'Stop Detection' : 'Start Detection'}
        </button>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <p>Status: {!model ? 'Loading AI model...' : detecting ? 'Detecting objects...' : 'Ready to detect'}</p>
        <p style={{ fontSize: '14px', color: '#666' }}>
          Detects: People, Cars, Trucks, Buses, Bicycles, Motorcycles
        </p>
      </div>
    </div>
  );
}

export default App;