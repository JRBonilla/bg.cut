function handleFiles(files) {
  const file = files[0];
  const fileList = document.getElementById('file-list');
  fileList.innerHTML = `<p>File name: ${file.name}</p>`;
}

function startProcessing() {
  const fileList = document.getElementById('file-list');
  const uploadStatus = document.getElementById('upload-status');
  const startBtn = document.getElementById('start-btn');

  if (fileList.innerHTML === '') {
      alert('Please select an image file first.');
      return;
  }

  uploadStatus.innerHTML = 'Processing...';
  startBtn.disabled = true;

  fetch('/upload', {
      method: 'POST',
      body: new FormData(document.querySelector('form')),
  })
  .then(response => response.json())
  .then(data => {
      const filename = data.filename;
      uploadStatus.innerHTML = `Processing ${filename}...`;

      checkProcessingStatus();
  })
  .catch(error => console.error('Error:', error));
}

function checkProcessingStatus() {
  fetch('/status')
  .then(response => response.json())
  .then(data => {
      if (data.processing) {
          setTimeout(checkProcessingStatus, 1000);
      } else {
          const uploadStatus = document.getElementById('upload-status');
          const startBtn = document.getElementById('start-btn');

          uploadStatus.innerHTML = 'Processing complete!';
          startBtn.disabled = false;
      }
  })
  .catch(error => console.error('Error:', error));
}