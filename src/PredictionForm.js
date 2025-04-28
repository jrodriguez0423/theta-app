import React, { useState } from "react";

const PredictionForm = () => {
  const [prediction, setPrediction] = useState(null);

  const [formData, setFormData] = useState({
    PM_HOUR: "",
    BACK_PEAK_HOUR: "",
    AHEAD_PEAK_HOUR: "",
    BACK_AADT: "",
    AHEAD_AADT: ""
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: Number(value)
    }));
  };

  const submitTrafficPrediction = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/predict/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      setPrediction({
        multiplier: data["Predicted Traffic Multiplier"],
        level: data["Traffic Level"] || "N/A"
      });
          } catch (error) {
      console.error("Prediction failed:", error);
    }
  };

  return (
    <div>
      <h2>Traffic Prediction</h2>

      <input name="PM_HOUR" placeholder="PM Hour" onChange={handleChange} />
      <input name="BACK_PEAK_HOUR" placeholder="Back Peak Hour" onChange={handleChange} />
      <input name="AHEAD_PEAK_HOUR" placeholder="Ahead Peak Hour" onChange={handleChange} />
      <input name="BACK_AADT" placeholder="Back AADT" onChange={handleChange} />
      <input name="AHEAD_AADT" placeholder="Ahead AADT" onChange={handleChange} />

      <button onClick={submitTrafficPrediction}>Predict</button>

      {prediction && (
        <div>
          <strong>Predicted Traffic Multiplier:</strong> {prediction.multiplier.toFixed(2)} <br />
          <strong>Traffic Level:</strong> {prediction.level}
        </div>
      )}
    </div>
  );
};

export default PredictionForm;
