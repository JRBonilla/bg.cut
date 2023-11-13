# Main application file

from flask import Flask, render_template, request, jsonify
import cv2
from SegmentationProcessor import SegmentationProcessor
import numpy as np
import base64
import webview
import threading

# Define the allowed file extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

# Create a Flask web application
app = Flask(__name__)

# Define the route for the main page
@app.route('/')
def index():
    return render_template('index.html')

# Checks if the provided file is an allowed file type
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Define the route for handling image uploads and processing
@app.route('/upload', methods=['POST'])
def upload():
    # Check if the 'file' part is present in the request
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})

    # Get the uploaded file from the request
    file = request.files['file']

    # Check if a file is selected
    if file.filename == '':
        return jsonify({'error': 'No selected file'})

    # Check if the file has an allowed extension
    if not allowed_file(file.filename):
        return jsonify({'error': 'Unsupported file type'})

    # Read the uploaded image using OpenCV
    image = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_UNCHANGED)

    # Check if the image is valid
    if image is None:
        return jsonify({'error': 'Invalid file'})

    # Ensure the image has 3 channels (convert if necessary)
    if image.shape[2] == 4:  # Assuming 4 channels (RGBA)
        image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
    elif image.shape[2] != 3:
        return jsonify({'error': 'Image does not have 3 channels'})

    # Create an instance of the SegmentationProcessor
    processor = SegmentationProcessor()

    # Perform segmentation on the uploaded image
    bboxes, classes, contours, scores = processor.detect(image)

    # Check if no segments are detected
    if not contours:
        return jsonify({'error': 'No segments detected'})

    # Convert the segmented image to base64 for rendering in HTML
    _, img_encoded = cv2.imencode('.png', image)
    img_base64 = base64.b64encode(img_encoded).decode('utf-8')

    # Return the segmentation results as JSON
    return jsonify({
        'image': img_base64,
        'bboxes': bboxes.tolist(),
        'classes': classes.tolist(),
        'contours': [c.flatten().tolist() for c in contours],
        'scores': scores.tolist()
    })

# Function to run the Flask application in a separate thread
def run_app():
    app.run(port=5000, threaded=True)

# Entry point of the script
if __name__ == '__main__':
    # Create a separate thread to run the Flask application
    t = threading.Thread(target=run_app)
    t.daemon = True
    t.start()

    # Create a webview window and start the application
    webview.create_window("bg.cut", "http://127.0.0.1:5000", width=1280, height=720)
    webview.start(debug=True)