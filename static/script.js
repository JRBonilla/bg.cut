// Function to handle file upload
function handleFiles(files) {
  // Create a FormData object to store the file
  const formData = new FormData();
  const file = files[0];

  // Append the file to the FormData object with key 'file'
  formData.append('file', file);

  // Send a POST request to the server with the file using fetch API
  fetch('/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    // Once the response is received, render the masks on the original image
    renderMasks(data.image, data.bboxes, data.contours);
  })
  .catch(error => console.error('Error:', error));
}

// Function to render masks on the original image
function renderMasks(imageData, bboxes, contours) {
  // Get the output div where the result will be displayed
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  // Create a canvas and its 2D context
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Create an image element to load the base64-encoded image
  const img = new Image();
  img.onload = function() {
    // Set canvas dimensions to match the image
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw the original image on the canvas
    ctx.drawImage(img, 0, 0);

    // Draw masks on the canvas
    for (let i = 0; i < bboxes.length; i++) {
      const [x1, y1, x2, y2] = bboxes[i];
      const color = getRandomColor();

      // Set style properties for the mask
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;

      const maskPoints = contours[i];

      // Begin drawing the mask
      ctx.beginPath();
      ctx.moveTo(maskPoints[0], maskPoints[1]);

      // Connect the points to form the mask shape
      for (let j = 2; j < maskPoints.length; j += 2) {
        ctx.lineTo(maskPoints[j], maskPoints[j + 1]);
      }

      // Close the mask shape
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  };

  // Set the source of the image element to the base64-encoded image data
  img.src = `data:image/png;base64,${imageData}`;

  // Append the canvas to the output div
  outputDiv.appendChild(canvas);
}

// Function to generate a random color
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
