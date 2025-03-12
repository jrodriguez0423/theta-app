import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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
  const [transportMode, setTransportMode] = useState('driving-car'); // Default mode
  const [departureTime, setDepartureTime] = useState(''); // User-selected departure time
  const [directions, setDirections] = useState(null);


  const mapRef = useRef(null);
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);
  const routeRef = useRef(null);

  const metersToMiles = (meters) => meters * 0.000621371;

  const userLocationIcon = L.icon({
    iconUrl: userMarkerIcon,  // Use your own image file
    iconSize: [32, 32],       // Adjust the size if needed
    iconAnchor: [16, 32],     // Center the icon properly
    popupAnchor: [0, -32]
  });


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


  const getDirections = async (startCoords, endCoords) => {
    if (!startCoords || !endCoords) {
        console.error("Error: Missing coordinates for directions request.");
        return null;
    }

    try {
        const response = await fetch(`https://api.openrouteservice.org/v2/directions/${transportMode}`, {
            method: "POST",
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                coordinates: [
                    [startCoords[1], startCoords[0]], // Correct order: [longitude, latitude]
                    [endCoords[1], endCoords[0]]     // Correct order: [longitude, latitude]
                ],
                instructions: true,
                radiuses: [500, 500] // Expands search radius in case of off-road locations
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Directions API Error:", errorData);
            alert(`Error fetching directions: ${errorData.error?.message || "Unknown error"}`);
            return null;
        }

        const data = await response.json();
        if (!data.routes || data.routes.length === 0) {
            console.error("No routes found.");
            alert("No route found. Please check your locations and try again.");
            return null;
        }

        setDirections(data.routes[0].segments[0].steps);
        return data.routes[0].summary;
    } catch (error) {
        console.error("Error fetching directions:", error.message);
        alert("Failed to fetch directions. Please try again later.");
        return null;
    }
  };



  useEffect(() => {
    const getUserLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = [position.coords.latitude, position.coords.longitude];
          setStartCoords(userCoords);
        },
        (error) => console.error("Geolocation error:", error),
        { enableHighAccuracy: true }
      );
    };
  
    getUserLocation();
  }, []);
  
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

    if (!routeRef.current) {
        routeRef.current = L.Routing.control({
            waypoints: [L.latLng(startCoords), L.latLng(endCoords)],
            routeWhileDragging: true,
            createMarker: () => null,
            lineOptions: {
                styles: [{ color: "#007bff", weight: 5 }]
            }
        }).addTo(mapRef.current);
    } else {
        routeRef.current.setWaypoints([L.latLng(startCoords), L.latLng(endCoords)]);
    }
}, [startCoords, endCoords]);


  const handleSubmit = async () => {
  const startCoordinates = await getCoords(startLocation);
  const endCoordinates = await getCoords(endLocation);

  if (!startCoordinates || !endCoordinates) {
      alert("Invalid address. Please try again.");
      return;
  }

  setStartCoords(startCoordinates);
  setEndCoords(endCoordinates);

  // Wait for state to update before fetching directions
  setTimeout(async () => {
      const directions = await getDirections(startCoordinates, endCoordinates);
      if (directions) {
          console.log("Estimated Travel Time:", (directions.duration / 60).toFixed(2), "minutes");
      }
    }, 500);
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
          <select
            onChange={(e) => setTransportMode(e.target.value)}
            className="select-field"
          >
            <option value="driving-car">Car</option>
            <option value="cycling-regular">Bike</option>
            <option value="foot-walking">Walking</option>
          </select>
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
  
      {/* Directions Container Positioned on the Right */}
      {directions && (
      <div className="directions-wrapper">
        <h3>Directions</h3>
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