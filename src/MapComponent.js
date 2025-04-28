import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';
import './App.css';
import userMarkerIcon from './images/pin.png'; // Ensure you have an image in your project
import './MapComponent.css';
import Logo from './images/Theta_Logo.png'

const apiKey = "5b3ce3597851110001cf624895e22c8199f54f01afb4aa7ce33fba3c";

const MapComponent = () => {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [startCoords, setStartCoords] = useState();
  const [endCoords, setEndCoords] = useState();
  const [departureTime, setDepartureTime] = useState(''); // User-selected departure time
  const [directions, setDirections] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [totalDuration, setTotalDuration] = useState(null); // in seconds
  const [directionsVisible, setDirectionsVisible] = useState(true);

  const mapRef = useRef(null);
  const startMarkerRef = useRef(null);
  const adjustedDuration = totalDuration * prediction;
  const routeLayerRef = useRef(null); // Add this near mapRef at the top

  const userLocationIcon = L.icon({
    iconUrl: userMarkerIcon,  // Use your own image file
    iconSize: [32, 32],       // Adjust the size if needed
    iconAnchor: [16, 32],     // Center the icon properly
    popupAnchor: [0, -32]
  });

  const getPrediction = async ({ PM_HOUR, BACK_PEAK_HOUR, AHEAD_PEAK_HOUR, BACK_AADT, AHEAD_AADT }) => {
    try {
      const response = await fetch("https://theta-svm.onrender.com/predict/", {   // <-- Note the slash!
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          PM_HOUR,
          BACK_PEAK_HOUR,
          AHEAD_PEAK_HOUR,
          BACK_AADT,
          AHEAD_AADT,
        }),
      });
  
      const data = await response.json();
      console.log("Server Response:", data);
      
      // ✅ Now access "Predicted Traffic Multiplier" correctly
      return data["Predicted Traffic Multiplier"];
    } catch (err) {
      console.error("Prediction request failed:", err);
      return null;
    }
  };    

  const formatDuration = (seconds) => {
    if (seconds === null) return "";
  
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
  
    if (hours > 0) {
      return `${hours} hr ${remainingMinutes} min`;
    } else {
      return `${minutes} min`;
    }
  };
  
  const getCoords = async (address) => {
    if (!address.trim()) {
        console.error("Error: Address is empty");
        return null;
    }

    try {
        const response = await fetch(`https://api.openrouteservice.org/geocode/search?text=${encodeURIComponent(address)}`, {
            headers: { 'Authorization': apiKey },
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Geocoding API Error:", errorData);
            throw new Error("Failed to fetch geolocation data.");
        }

        const data = await response.json();
        if (!data.features || data.features.length === 0) {
            throw new Error("No results found for the given address.");
        }

        return [data.features[0].geometry.coordinates[1], data.features[0].geometry.coordinates[0]];
    } catch (error) {
        console.error("Error fetching geolocation:", error.message);
        return null;
    }
  };

  const calculateETA = () => {
    if (adjustedDuration === null) return "";
  
    // If user picked a departure time, use it; otherwise use current time
    const baseTime = departureTime ? new Date(departureTime) : new Date();
  
    // Add adjusted duration (in seconds) to base time
    const eta = new Date(baseTime.getTime() + adjustedDuration * 1000);
  
    // Format nicely (like 11:43 AM)
    const hours = eta.getHours();
    const minutes = eta.getMinutes().toString().padStart(2, '0');
  
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHour = hours % 12 === 0 ? 12 : hours % 12;
  
    return `${formattedHour}:${minutes} ${ampm}`;
  };


  const getDirectionsAndDrawRoute = async (startCoords, endCoords) => {
    if (!startCoords || !endCoords) {
      console.error("Error: Missing coordinates for directions request.");
      return null;
    }
  
    try {
      const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: "POST",
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: [
            [startCoords[1], startCoords[0]],
            [endCoords[1], endCoords[0]]
          ],
          instructions: true,
          radiuses: [1000, 1000]
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Directions API Error:", errorData);
        alert(`Error fetching directions: ${errorData.error?.message || "Unknown error"}`);
        return null;
      }
  
      const data = await response.json();
      console.log("Fetched Route Data:", data);
  
      if (!data.features || data.features.length === 0) {
        console.error("No routes found.");
        alert("No route found. Please check your locations and try again.");
        return null;
      }
  
      // ✅ Extract steps (instructions)
      const steps = data.features[0].properties.segments[0].steps;
      setDirections(steps);
  
      // ✅ Extract geometry and draw the line
      const routeCoordinates = data.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
  
      if (routeLayerRef.current) {
        mapRef.current.removeLayer(routeLayerRef.current);
      }
  
      routeLayerRef.current = L.polyline(routeCoordinates, { color: 'blue', weight: 5 }).addTo(mapRef.current);
      mapRef.current.fitBounds(routeLayerRef.current.getBounds());
  
      // ✅ Return the summary too
      return data.features[0].properties.summary;
    } catch (error) {
      console.error("Error fetching or drawing route:", error.message);
      alert("Failed to fetch directions. Please try again later.");
      return null;
    }
  };
  
  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map('map').setView([0, 0], 2); // Default start view
      mapRef.current = map;
  
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    }
  
    if (startCoords && mapRef.current) {
      mapRef.current.setView(startCoords, 13);
  
      // Ensure marker exists before updating its position
      if (!startMarkerRef.current) {
        startMarkerRef.current = L.marker(startCoords, { icon: userLocationIcon })
          .addTo(mapRef.current)
          .bindPopup("You are here")
          .openPopup();
      } else {
        startMarkerRef.current.setLatLng(startCoords).bindPopup("You are here").openPopup();
      }
    }
  }, [startCoords]);  
  

useEffect(() => {
  if (!mapRef.current || !startCoords || !endCoords) return;

  // 🚨 Clear old route if exists
  if (routeLayerRef.current) {
    mapRef.current.removeLayer(routeLayerRef.current);
    routeLayerRef.current = null;
  }
  
  const fetchRoute = async () => {
    try {
      const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coordinates: [
            [startCoords[1], startCoords[0]], // long, lat
            [endCoords[1], endCoords[0]]      // long, lat
          ]
        })
      });

      const data = await response.json();

      const routeCoordinates = data.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);

      // 🚀 Draw the route manually
      routeLayerRef.current = L.polyline(routeCoordinates, { color: 'blue', weight: 5 }).addTo(mapRef.current);

      mapRef.current.fitBounds(routeLayerRef.current.getBounds());
    } catch (err) {
      console.error("Routing fetch error:", err);
    }
  };

  fetchRoute();
}, [startCoords, endCoords]);



const handleSubmit = async () => {
  let startCoordinates;
  let endCoordinates;

  // ⚡️ NEW: If user used "Current Location", skip geocoding and use already known startCoords
  if (startLocation === "Current Location" && startCoords) {
    startCoordinates = startCoords;
  } else {
    startCoordinates = await getCoords(startLocation);
  }

  endCoordinates = await getCoords(endLocation);

  if (!startCoordinates || !endCoordinates) {
    alert("Invalid address. Please try again.");
    return;
  }

  setStartCoords(startCoordinates);
  setEndCoords(endCoordinates);

  const routeSummary = await getDirectionsAndDrawRoute(startCoordinates, endCoordinates);

  if (routeSummary) {
    const duration = routeSummary.duration; // in seconds
    setTotalDuration(duration);

    const departureHour = new Date(departureTime).getHours();
    const backPeakHour = 17;
    const aheadPeakHour = 17;
    const backAADT = 50000;
    const aheadAADT = 60000;

    const predictionResult = await getPrediction({
      PM_HOUR: departureHour,
      BACK_PEAK_HOUR: backPeakHour,
      AHEAD_PEAK_HOUR: aheadPeakHour,
      BACK_AADT: backAADT,
      AHEAD_AADT: aheadAADT
    });

    if (predictionResult !== null) {
      setPrediction(predictionResult);
    }
  }
};

  return (
    <div className="map-wrapper">
      {/* New header container for logo and input row */}
      <div className="header-container">
        {/* Logo placed separately on the left */}
        <img src={Logo} alt="THETA Logo" className="app-logo" />
  
        {/* Input row remains centered */}
        <div className="input-overlay">
          <input
            type="text"
            placeholder="Enter start location"
            value={startLocation}
            onChange={(e) => setStartLocation(e.target.value)}
            className="input-field"
          />
          <input
            type="text"
            placeholder="Enter end location"
            value={endLocation}
            onChange={(e) => setEndLocation(e.target.value)}
            className="input-field"
          />
          <input
            type="datetime-local"
            onChange={(e) => setDepartureTime(e.target.value)}
            className="input-field"
          />
          <button onClick={handleSubmit} className="primary-button">
            Get Directions
          </button>
        </div>
      </div>
  
      {/* Map container remains below */}
      <div id="map" className="map-container"></div>

      {/* Expand Button when Directions are Hidden */}
      {directions && !directionsVisible && (
        <button 
          onClick={() => setDirectionsVisible(true)} 
          className="expand-button"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 1000,
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            padding: '8px 12px',
            cursor: 'pointer'
          }}
        >
          Show Directions
        </button>
      )}

      {/* Directions Container Positioned on the Right */}
      {directions && directionsVisible && (
        <div className="directions-wrapper">
          {/* directions content */}
          <button onClick={() => setDirectionsVisible(false)} className="collapse-button">Hide Directions</button>
          <h3>Directions</h3>

          {prediction !== null && (
            <p><strong>Predicted Traffic Multiplier:</strong> {prediction}</p>
          )}
          {totalDuration !== null && (
            <p><strong>Regular Travel Time:</strong> {formatDuration(totalDuration)}</p>
          )}
          {totalDuration !== null && (
            <p><strong>Adjusted Travel Time:</strong> {formatDuration(adjustedDuration)}</p>
          )}
          {totalDuration !== null && (
            <p><strong>Estimated Arrival Time (ETA):</strong> {calculateETA()}</p>
          )}

          <div className="directions-container">
            {directions.map((step, index) => (
              <p key={index}>{step.instruction}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );  
};

export default MapComponent;