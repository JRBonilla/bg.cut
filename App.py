from flask import Flask, render_template, request, jsonify
import os
from werkzeug.utils import secure_filename
import time
import threading
import webview

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.static_folder = 'static'

processing = False

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_image(filename):
    # Simulate a time-consuming image processing task
    time.sleep(50)
    # In a real scenario, perform image segmentation and return masks
    # This is where you would integrate your image processing logic

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    global processing

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'})

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)

        # Start the image processing thread
        if not processing:
            processing_thread = threading.Thread(target=process_image, args=(file_path,))
            processing_thread.start()

        return jsonify({'filename': filename})
    else:
        return jsonify({'error': 'Invalid file format'})

@app.route('/status')
def status():
    global processing
    return jsonify({'processing': processing})

def run_app():
    app.run(port=5000, threaded=True)

if __name__ == '__main__':
    t = threading.Thread(target=run_app)
    t.daemon = True
    t.start()

    webview.create_window("bg.cut", "http://127.0.0.1:5000", width=1280, height=720)
    webview.start()
