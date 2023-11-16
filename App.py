# Main application file

from flask import Flask, render_template, request, jsonify
import cv2
import numpy as np
import base64
import webview
import threading
import random
from SegmentationProcessor import SegmentationProcessor

# Define the allowed file extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

# Create a Flask web application
app = Flask(__name__)

# Create an instance of the SegmentationProcessor
processor = SegmentationProcessor()

# Store the uploaded image
uploaded_image = None
contours = []

# Define the route for the main page
@app.route('/')
def index():
    return render_template('index.html')

# Checks if the provided file is an allowed file type
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Convert RGB color to hexadecimal string
def rgb_to_hex(color):
    return "#{:02x}{:02x}{:02x}".format(color[0], color[1], color[2])

# Define the route for handling image uploads
@app.route('/upload', methods=['POST'])
def upload():
    global uploaded_image

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

    # Convert the segmented image to base64 for rendering in HTML
    _, img_encoded = cv2.imencode('.png', image)
    img_base64 = base64.b64encode(img_encoded).decode('utf-8')

    uploaded_image = image

    return jsonify({'image': img_base64})

# Define the route for analyzing the uploaded image
@app.route('/analyze', methods=['POST'])
def analyze():
    global contours

    # Perform segmentation on the uploaded image
    bboxes, classes, contours, scores = processor.detect(uploaded_image)

    # Check if no segments are detected
    if not contours:
        return jsonify({'error': 'No segments detected'})
    
    # Create an empty image with each mask drawn in a unique RGB color
    mask_overlay = np.zeros_like(uploaded_image)
    colors = [(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)) for _ in contours]
    for contour, color in zip(contours, colors):
        bgr_color = (color[2], color[1], color[0]) # Convert RGB color to BGR for OpenCV
        cv2.fillPoly(mask_overlay, [contour], bgr_color)

    # Encode the image for JSON response
    _, img_encoded = cv2.imencode('.png', mask_overlay)
    img_base64 = base64.b64encode(img_encoded).decode('utf-8')

    # Return the segmentation results as JSON
    return jsonify({
        'bboxes': bboxes.tolist(),
        'classes': classes.tolist(),
        'contours': [c.flatten().tolist() for c in contours],
        'scores': scores.tolist(),
        'mask_overlay': img_base64,
        'colors': [rgb_to_hex(color) for color in colors]
    })

# Define the route for cutting the selected masks and compositing them as one image
@app.route('/cut', methods=['POST'])
def cut():
    try:
        # Check if 'selected_masks' is present and is a list
        if 'selected_masks' not in request.json or not isinstance(request.json['selected_masks'], list):
            raise ValueError('Invalid or missing selected masks data')

        selected_masks = request.json['selected_masks']

        # Create a binary mask for each selected contour and combine them into one mask
        combined_mask = np.zeros_like(uploaded_image)
        for mask_index in selected_masks:
            if 0 <= mask_index < len(contours):
                contour = contours[mask_index]
                mask = np.zeros_like(uploaded_image)
                cv2.fillPoly(mask, [contour], (255, 255, 255))  # White mask where the contour is
                combined_mask = cv2.add(combined_mask, mask)  # Combine masks

        # Apply the combined mask to the original image
        result = cv2.bitwise_and(uploaded_image, combined_mask)

        # Save the result image
        cv2.imwrite('Assets/Images/results.png', result)

        # Encode the image for JSON response
        _, img_encoded = cv2.imencode('.png', result)
        img_base64 = base64.b64encode(img_encoded).decode('utf-8')

        return jsonify({
            'result': img_base64
        })

    except Exception as e:
        return jsonify({
            'error': str(e)
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
    webview.create_window("bg.cut", "http://127.0.0.1:5000", width=1440, height=900)
    webview.start(debug=True)