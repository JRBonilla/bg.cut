const selectFile = () => document.getElementById('fileInput').click();

let uploadedImage = null;
let editedImage = null;
let selectedMasks = [];
let padding = 40;

const createCanvasAndContext = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  return { canvas, context };
};

const uploadImage = async (files) => {
  const formData = new FormData();
  formData.append('file', files[0]);

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    uploadedImage = `data:image/png;base64,${data.image}`;

    showImage();
    analyzeImage();
  } catch (error) {
    console.error('Error:', error);
  }
};

const showImage = () => {
  const container = document.getElementById('uploadContainer');
  container.innerHTML = '<input type="file" id="fileInput" accept=".png, .jpeg, .jpg" style="display:none" onchange="uploadImage(this.files)">';

  const scaledImg = new Image();
  scaledImg.src = uploadedImage;
  scaledImg.onload = () => {
    const { clientWidth: maxWidth, clientHeight: maxHeight } = container;
    const scale = Math.min((maxWidth - padding) / scaledImg.width, (maxHeight - padding) / scaledImg.height);

    const imgElement = document.createElement('img');
    imgElement.id = 'uploadedImg';
    imgElement.src = uploadedImage;
    imgElement.classList.add('faded-out');
    imgElement.style.width = `${scaledImg.width * scale}px`;
    imgElement.style.height = `${scaledImg.height * scale}px`;

    container.appendChild(imgElement);
    container.appendChild(document.createElement('div')).classList.add('dot-spin');
  };
};

const analyzeImage = async () => {
  cutBtn.disabled = true;

  try {
    const response = await fetch('/analyze', {
      method: 'POST'
    });
    const data = await response.json();

    uploadContainer.querySelector('.dot-spin').remove();
    changeBtn.disabled = false;

    renderMasks(data.contours, data.colors, data.mask_overlay);
  } catch (error) {
    console.error('Error:', error);
  }
};

const renderMasks = async (contours, colors, overlay) => {
  const container = document.getElementById('uploadContainer');
  container.innerHTML = '<input type="file" id="fileInput" accept=".png, .jpeg, .jpg" style="display:none" onchange="uploadImage(this.files)">';

  const img = new Image();
  img.src = uploadedImage;
  img.onload = () => {
    // Calculate the scaled canvas width and height
    const { clientWidth: maxWidth, clientHeight: maxHeight } = container;
    const scale = Math.min((maxWidth - padding) / img.width, (maxHeight - padding) / img.height);
    const [canvasWidth, canvasHeight] = [img.width * scale, img.height * scale];

    // Draw the uploaded image on one canvas
    const { canvas: imageCanvas, context: imageCtx } = createCanvasAndContext(canvasWidth, canvasHeight);
    imageCtx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);

    // Then draw the masks onto a separate canvas
    const { canvas: maskCanvas, context: maskCtx } = createCanvasAndContext(canvasWidth, canvasHeight);
    for (let i = 0; i < contours.length; i++) {
      drawContours(contours[i], colors[i], maskCtx, scale);
    }

    // Combine the two canvases into one
    const { canvas: combinedCanvas, context: combinedCtx } = createCanvasAndContext(canvasWidth, canvasHeight);
    combinedCtx.drawImage(imageCanvas, 0, 0);
    combinedCtx.drawImage(maskCanvas, 0, 0);
    
    // Push the canvas to the upload container
    container.appendChild(combinedCanvas);
    
    // Create an invisible canvas for the overlay
    const { canvas: overlayCanvas, context: overlayCtx } = createCanvasAndContext(canvasWidth, canvasHeight);
    const overlayImg = new Image();
    overlayImg.src = `data:image/png;base64,${overlay}`;
    overlayImg.onload = () => {
      overlayCtx.drawImage(overlayImg, 0, 0, overlayCanvas.width, overlayCanvas.height);
    };

    // Add click event listener to the combined canvas
    combinedCanvas.addEventListener('click', (event) => {
      const rect = combinedCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Check the corresponding pixel color on the overlay
      const overlayX = Math.floor(x);
      const overlayY = Math.floor(y);

      // Get the RGBA values of the clicked pixel from the overlay
      const overlayImageData = overlayCtx.getImageData(overlayX, overlayY, 1, 1).data;
      const clickedColor = `#${overlayImageData[0].toString(16).padStart(2, '0')}${overlayImageData[1].toString(16).padStart(2, '0')}${overlayImageData[2].toString(16).padStart(2, '0')}`;

      // Check if the clicked color is not black; if not, then a mask is selected
      if (clickedColor !== '#000000' && clickedColor !== '#000') {
        const selectedMaskIndex = colors.indexOf(clickedColor);
        if (selectedMaskIndex >= 0) {
          handleMaskSelection(contours, selectedMaskIndex, colors, maskCtx, imageCtx, combinedCtx, scale);
        }
      }
    });
  };
};

const handleMaskSelection = (masks, selectedMaskIndex, colors, maskCtx, imageCtx, combinedCtx, scale) => {
  maskCtx.clearRect(0, 0, maskCtx.canvas.width, maskCtx.canvas.height);

  if (!selectedMasks.includes(selectedMaskIndex)) {
    // If the mask isn't already selected, add it to the list and highlight it on the context
    selectedMasks.push(selectedMaskIndex);
  } else {
    // If the mask is already selected, remove it from the list and redraw with the original styling
    const indexToRemove = selectedMasks.indexOf(selectedMaskIndex);
    selectedMasks.splice(indexToRemove, 1);
  }

  cutBtn.disabled = selectedMasks.length == 0 ? true : false;
  console.log(selectedMasks);

  redrawMasks(masks, colors, maskCtx, scale);

  combinedCtx.clearRect(0, 0, combinedCtx.canvas.width, combinedCtx.canvas.height);
  combinedCtx.drawImage(imageCtx.canvas, 0, 0);
  combinedCtx.drawImage(maskCtx.canvas, 0, 0);
};

const redrawMasks = (contours, colors, ctx, scale) => {
  for (let i = 0; i < contours.length; i++) {
    const color = !selectedMasks.includes(i) ? colors[i] : 'white';
    drawContours(contours[i], color, ctx, scale);
  }
};

const drawContours = (contours, color, ctx, scale) => {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(contours[0] * scale, contours[1] * scale);

  for (let i = 2; i < contours.length; i += 2) {
    ctx.lineTo(contours[i] * scale, contours[i + 1] * scale);
  }

  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 0.3;
  ctx.fill();
  ctx.globalAlpha = 1.0;
};

const cutSelectedMasks = async () => {
  // Disable buttons, show output area with new image
  changeBtn.disabled = true;
  cutBtn.disabled = true;

  try {
    const response = await fetch('/cut', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ selected_masks: selectedMasks })
    });
    const data = await response.json();

    result = `data:image/png;base64,${data.result}`;
    editedImage = result;

    const container = document.getElementById('resultContainer');
    container.innerHTML = '<input type="file" id="fileInput" accept=".png, .jpeg, .jpg" style="display:none" onchange="uploadImage(this.files)">';
    outputArea.style.display = "block";
    container.appendChild(document.createElement('div')).classList.add('dot-spin');
  
    const scaledImg = new Image();
    scaledImg.src = result;
    scaledImg.onload = () => {
      const { clientWidth: maxWidth, clientHeight: maxHeight } = container;
      const scale = Math.min(maxWidth / scaledImg.width, maxHeight / scaledImg.height);
  
      const imgElement = document.createElement('img');
      imgElement.id = 'uploadedImg';
      imgElement.src = result;
      imgElement.style.width = `${scaledImg.width * scale}px`;
      imgElement.style.height = `${scaledImg.height * scale}px`;
  
      container.appendChild(imgElement);
    };

    resultContainer.querySelector('.dot-spin').remove();

    changeBtn.disabled = false;
    cutBtn.disabled = false;

  } catch (error) {
    console.error('Error: ', error);
  }
};

const trimImage = async () => {
  try {
    const response = await fetch('/trim', {
      method: 'POST'
    });
    const data = await response.json();

    result = `data:image/png;base64,${data.trimmed}`;
    editedImage = result;

    const container = document.getElementById('resultContainer');
    container.innerHTML = '<input type="file" id="fileInput" accept=".png, .jpeg, .jpg" style="display:none" onchange="uploadImage(this.files)">';

    const scaledImg = new Image();
    scaledImg.src = result;
    scaledImg.onload = () => {
      const { clientWidth: maxWidth, clientHeight: maxHeight } = container;
      const scale = Math.min(maxWidth / scaledImg.width, maxHeight / scaledImg.height);
  
      const imgElement = document.createElement('img');
      imgElement.id = 'uploadedImg';
      imgElement.src = result;
      imgElement.style.width = `${scaledImg.width * scale}px`;
      imgElement.style.height = `${scaledImg.height * scale}px`;
  
      container.appendChild(imgElement);
    };
  } catch (error) {
    console.error('Error: ', error);
  }
}

const saveImage = async () => {
  try {
    if ('showSaveFilePicker' in window) {
      // Use the File System Access API if available
      const fileHandle = await showSaveFilePicker({
        suggestedName: 'output_image.png',
        types: [{
          description: 'PNG Files',
          accept: { 'image/png': ['.png'] },
        }],
      });

      const writable = await fileHandle.createWritable();
      await writable.write(await fetch(editedImage).then(response => response.blob()));
      await writable.close();
    } else {
      // Fallback to standard download behavior
      const downloadLink = document.createElement('a');
      downloadLink.href = editedImage;
      downloadLink.download = 'output_image.png';
      downloadLink.click();
    }
  } catch (error) {
    console.error('Error: ', error);
  }
};