import os
import threading
import webview
import sys

def run_flask():
    os.system("python app.py")

if __name__ == '__main__':
    # Start Flask in a separate thread
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.start()

    # Create WebView window
    webview.create_window("Image Processing App", "http://127.0.0.1:5000/", width=800, height=600)
    webview.start()
    sys.exit()