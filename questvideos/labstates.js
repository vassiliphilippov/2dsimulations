materialChoice = {
  [
    {
      
    },
  ]
};

heatingLabStates = {
  idle: {
    name: "Idle",
    videoFile: "idle.mp4",
    pictures: {
      material: "material_choose.jpg",
      temperature: "temperature_room.jpg"
    },
    pictureClicks: {
      material: materialChoice,
      temperature: temperatureChoice
    }  
  },

  iron20: {
    name: "Iron 20°C",
    videoFile: "iron20.mp4",
    pictures: {
      material: "material_iron.jpg",
      temperature: "temperature_20.jpg"
    },
    pictureClicks: {
      material: materialChoice,
      temperature: temperatureChoice
    }  
  },
};