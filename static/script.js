const selectImage = () => document.getElementById('fileInput').click();

let uploadedImage = null;
let outputImage = null;
let selectedMasks = [];
let padding = 40;

let instructions = null;
let fileLabel = null;
let fileInput = null;

document.addEventListener('DOMContentLoaded', () => {
  const uploadContainer = document.getElementById('uploadContainer');
  [instructions, fileLabel, fileInput] = uploadContainer.children;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadContainer.addEventListener(eventName, e => e.preventDefault(), false);
    document.body.addEventListener(eventName, e => e.preventDefault(), false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    uploadContainer.addEventListener(eventName, () => uploadContainer.classList.add('drag-over'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadContainer.addEventListener(eventName, () => uploadContainer.classList.remove('drag-over'), false);
  });

  uploadContainer.addEventListener('drop', async e => {
    const files = e.dataTransfer.files;
    await uploadImage(files);
  });
});

const createCanvasAndContext = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  return { canvas, context };
};

const uploadImage = async (files) => {
  // Reset the values if they are already set
  uploadedImage = null;
  outputImage = null;
  selectedMasks = [];

  const formData = new FormData();
  formData.append('file', files[0]);

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();

    uploadedImage = `data:image/png;base64,${data.image}`;
    displayImage();
    analyzeImage();
    
    // Clear the file input value
    document.getElementById('fileInput').value = '';
  } catch (error) {
    console.error('Error:', error);
  }
};

const displayImage = () => {
  const container = document.getElementById('uploadContainer');
  container.innerHTML = '';
  container.appendChild(fileInput);

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

    if ('error' in data) {
      // Handle the case where no objects are detected
      alert(data.error);

      // Reset upload container
      const container = document.getElementById('uploadContainer');
      container.innerHTML = '';
      container.appendChild(instructions);
      container.appendChild(fileLabel);
      container.appendChild(fileInput);
    } else {
      uploadContainer.querySelector('.dot-spin').remove();
      changeBtn.disabled = false;
      renderMasks(data.contours, data.colors, data.mask_overlay);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

const renderMasks = async (contours, colors, overlay) => {
  const container = document.getElementById('uploadContainer');
  container.innerHTML = '';
  container.appendChild(fileInput);

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

      // Check the corresponding pixel color on the overlay
      const overlayX = Math.floor(event.clientX - rect.left);
      const overlayY = Math.floor(event.clientY - rect.top);

      // Get the RGBA values of the clicked pixel from the overlay
      const overlayImageData = overlayCtx.getImageData(overlayX, overlayY, 1, 1).data;
      const clickedColor = `#${overlayImageData[0].toString(16).padStart(2, '0')}${overlayImageData[1].toString(16).padStart(2, '0')}${overlayImageData[2].toString(16).padStart(2, '0')}`;

      // Check if the clicked color is not black; if not, then a mask is selected
      if (clickedColor !== '#000000' && clickedColor !== '#000') {
        const selectedMaskIndex = colors.indexOf(clickedColor);
        if (selectedMaskIndex >= 0) {
          const contexts = { maskCtx, imageCtx, combinedCtx };
          updateMaskSelection(contours, selectedMaskIndex, colors, contexts, scale);
        }
      }
    });
  };
};

const updateMaskSelection = (masks, selectedMaskIndex, colors, contexts, scale) => {
  const { maskCtx: maskCtx, imageCtx: imageCtx, combinedCtx: combinedCtx } = contexts;

  // Add or remove the selected mask as needed
  if (!selectedMasks.includes(selectedMaskIndex)) {
    selectedMasks.push(selectedMaskIndex);
  } else {
    const indexToRemove = selectedMasks.indexOf(selectedMaskIndex);
    selectedMasks.splice(indexToRemove, 1);
  }
  
  // Clear the mask context and then redraw all masks
  maskCtx.clearRect(0, 0, maskCtx.canvas.width, maskCtx.canvas.height);
  redrawMasks(masks, colors, maskCtx, scale);
  
  // Refresh the combined context with updated mask and image contexts
  combinedCtx.clearRect(0, 0, combinedCtx.canvas.width, combinedCtx.canvas.height);
  combinedCtx.drawImage(imageCtx.canvas, 0, 0);
  combinedCtx.drawImage(maskCtx.canvas, 0, 0);
  
  // Toggle the cut button based on number of selected masks
  cutBtn.disabled = selectedMasks.length == 0 ? true : false;
};

const redrawMasks = (contours, colors, ctx, scale) => {
  for (let i = 0; i < contours.length; i++) {
    const isSelected = selectedMasks.includes(i);
    const color = isSelected ? 'white' : colors[i];
    drawContours(contours[i], color, ctx, scale, isSelected);
  }
};

const drawContours = (contours, color, ctx, scale, isSelected = false) => {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = isSelected ? 3 : 1;

  ctx.beginPath();
  ctx.moveTo(contours[0] * scale, contours[1] * scale);

  for (let i = 2; i < contours.length; i += 2) {
    ctx.lineTo(contours[i] * scale, contours[i + 1] * scale);
  }

  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 0.4;
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
    outputImage = result;

    const container = document.getElementById('resultContainer');
    container.innerHTML = '';
    container.appendChild(fileInput);
    outputArea.style.display = "block";
    container.appendChild(document.createElement('div')).classList.add('dot-spin');
  
    const scaledImg = new Image();
    scaledImg.src = result;
    scaledImg.onload = () => {
      const { clientWidth: maxWidth, clientHeight: maxHeight } = container;
      const scale = Math.min((maxWidth - padding) / scaledImg.width, (maxHeight - padding) / scaledImg.height);
  
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
    outputImage = result;

    const container = document.getElementById('resultContainer');
    container.innerHTML = '';
    container.appendChild(fileInput);

    const trimmedImg = new Image();
    trimmedImg.src = result;
    trimmedImg.onload = () => {
      const { clientWidth: maxWidth, clientHeight: maxHeight } = container;
      const scale = Math.min((maxWidth - padding) / trimmedImg.width, (maxHeight - padding) / trimmedImg.height);
  
      const imgElement = document.createElement('img');
      imgElement.id = 'uploadedImg';
      imgElement.src = result;
      imgElement.style.width = `${trimmedImg.width * scale}px`;
      imgElement.style.height = `${trimmedImg.height * scale}px`;
  
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
      await writable.write(await fetch(outputImage).then(response => response.blob()));
      await writable.close();
    } else {
      // Fallback to standard download behavior
      const downloadLink = document.createElement('a');
      downloadLink.href = outputImage;
      downloadLink.download = 'output_image.png';
      downloadLink.click();
    }
  } catch (error) {
    console.error('Error: ', error);
  }
};