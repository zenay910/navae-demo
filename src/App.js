import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [model, setModel] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [lastAlerts, setLastAlerts] = useState({}); // Track last alert times
  const [facingMode, setFacingMode] = useState('environment'); // 'user' = front, 'environment' = back

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

  // NEW: Alert function with cooldown
  const triggerAlert = (objectType) => {
    const now = Date.now();
    const lastAlertTime = lastAlerts[objectType] || 0;
    const cooldownPeriod = 3000; // 3 seconds cooldown per object type
    
    // Only trigger if enough time has passed since last alert of this type
    if (now - lastAlertTime > cooldownPeriod) {
      const alertMessage = `⚠️ ${objectType.toUpperCase()} DETECTED`;
      const newAlert = { id: now, message: alertMessage };
      setAlerts(prev => [...prev, newAlert]);
      
      // Update last alert time for this object type
      setLastAlerts(prev => ({ ...prev, [objectType]: now }));
      
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

  // Toggle camera facing mode
  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
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
    <div className="App" style={{ 
      textAlign: 'center', 
      padding: '10px',
      minHeight: '100vh',
      backgroundColor: '#000',
      color: '#fff'
    }}>
      <h1 style={{ 
        fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
        marginBottom: '20px',
        background: 'linear-gradient(45deg, #00ff88, #0088ff)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }}>
        Navae AI Driver Assistant
      </h1>
      
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
      
      <div style={{ 
        position: 'relative', 
        display: 'inline-block',
        width: '100%',
        maxWidth: '100vw',
        borderRadius: '15px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 255, 136, 0.3)'
      }}>
        <Webcam
          ref={webcamRef}
          mirrored={facingMode === 'user'}
          videoConstraints={{
            facingMode: facingMode
          }}
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '70vh',
            objectFit: 'cover'
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
      
      <div style={{ 
        marginTop: '20px',
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={toggleDetection}
          disabled={!model}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            backgroundColor: detecting ? '#ff4444' : '#00ff88',
            color: '#000',
            border: 'none',
            borderRadius: '25px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(0, 255, 136, 0.3)',
            transition: 'all 0.3s ease'
          }}
        >
          {!model ? 'Loading AI...' : detecting ? '🛑 Stop Detection' : '🚀 Start Detection'}
        </button>
        
        <button
          onClick={toggleCamera}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            backgroundColor: '#0088ff',
            color: '#fff',
            border: 'none',
            borderRadius: '25px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(0, 136, 255, 0.3)',
            transition: 'all 0.3s ease'
          }}
        >
          📱 {facingMode === 'user' ? 'Use Back Camera' : 'Use Front Camera'}
        </button>
      </div>
      
      <div style={{ 
        marginTop: '20px',
        padding: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '15px',
        backdropFilter: 'blur(10px)'
      }}>
        <p style={{ 
          fontSize: '16px',
          marginBottom: '10px',
          color: detecting ? '#00ff88' : '#fff'
        }}>
          Status: {!model ? 'Loading AI model...' : detecting ? '🟢 Actively Monitoring' : '⚪ Ready to Monitor'}
        </p>
        <p style={{ 
          fontSize: '14px', 
          color: '#aaa',
          lineHeight: '1.4'
        }}>
          🎯 Detecting: People, Cars, Trucks, Buses, Bicycles, Motorcycles<br/>
          📱 Camera: {facingMode === 'user' ? 'Front' : 'Back'} | 🔄 Alerts cooldown: 3s
        </p>
      </div>
    </div>
  );
}

export default App;