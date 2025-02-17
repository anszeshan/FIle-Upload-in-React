import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const App = () => {
  // State management for file upload and storage
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [storedFiles, setStoredFiles] = useState([]);
  
  // Reference for tracking upload start time
  const uploadStartTimeRef = useRef(null);

  // Initialize the file system when component mounts
  useEffect(() => {
    initializeFileSystem();
  }, []);

  // Function to initialize the file system and create upload directory
  const initializeFileSystem = async () => {
    try {
      // Request persistent storage permission
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log(`Persistent storage granted: ${isPersisted}`);
      }

      // Initialize IndexedDB for file storage
      const request = indexedDB.open('FileUploadDB', 1);
      
      request.onerror = (event) => {
        setErrorMessage('Failed to initialize storage system');
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Create an object store for files if it doesn't exist
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'name' });
        }
      };

      request.onsuccess = (event) => {
        loadStoredFiles();
      };
    } catch (error) {
      setErrorMessage('Error initializing storage system');
    }
  };

  // Function to load already stored files
  const loadStoredFiles = () => {
    const request = indexedDB.open('FileUploadDB', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['files'], 'readonly');
      const objectStore = transaction.objectStore('files');
      const getAllRequest = objectStore.getAll();

      getAllRequest.onsuccess = () => {
        setStoredFiles(getAllRequest.result);
      };
    };
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setErrorMessage('');
    
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.type !== 'application/pdf') {
      setErrorMessage('Please select a PDF file only');
      setSelectedFile(null);
      event.target.value = null;
      return;
    }

    setSelectedFile(file);
    setUploadProgress(0);
    setEstimatedTime(null);
    setUploadStatus('');
  };

  // Function to store file in IndexedDB
  const storeFile = async (file) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FileUploadDB', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['files'], 'readwrite');
        const objectStore = transaction.objectStore('files');

        // Create a file object with metadata
        const fileObject = {
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
          content: file,
          uploadDate: new Date().toISOString()
        };

        const storeRequest = objectStore.add(fileObject);

        storeRequest.onsuccess = () => {
          loadStoredFiles(); // Refresh the list of stored files
          resolve();
        };

        storeRequest.onerror = () => {
          reject(new Error('Error storing file'));
        };
      };
    });
  };

  // Handle file upload and storage
  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a file first');
      return;
    }

    try {
      setUploadStatus('uploading');
      uploadStartTimeRef.current = Date.now();
      
      // Simulate upload chunks while actually storing the file
      const chunkSize = selectedFile.size / 100;
      let uploadedSize = 0;

      while (uploadedSize < selectedFile.size) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        uploadedSize += chunkSize;
        const progress = Math.min((uploadedSize / selectedFile.size) * 100, 100);
        setUploadProgress(progress);

        // Calculate estimated time remaining
        const elapsedTime = (Date.now() - uploadStartTimeRef.current) / 1000;
        const uploadSpeed = uploadedSize / elapsedTime;
        const remainingBytes = selectedFile.size - uploadedSize;
        const estimatedSeconds = remainingBytes / uploadSpeed;
        
        setEstimatedTime(Math.ceil(estimatedSeconds));
      }

      // Store the file in IndexedDB
      await storeFile(selectedFile);

      setUploadStatus('completed');
      setEstimatedTime(null);
      
    } catch (error) {
      setErrorMessage('An error occurred during upload: ' + error.message);
      setUploadStatus('error');
    }
  };

  // Function to delete a stored file
  const handleDelete = async (fileName) => {
    const request = indexedDB.open('FileUploadDB', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['files'], 'readwrite');
      const objectStore = transaction.objectStore('files');
      const deleteRequest = objectStore.delete(fileName);

      deleteRequest.onsuccess = () => {
        loadStoredFiles(); // Refresh the list of stored files
      };
    };
  };

  // Format the estimated time into a user-friendly string
  const formatEstimatedTime = (seconds) => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min ${remainingSeconds} sec`;
  };

  // Format file size into readable format
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="upload-container">
      <h1>PDF File Upload</h1>
      
      <div className="upload-box">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="file-input"
        />
        
        {selectedFile && (
          <div className="file-info">
            <p>Selected file: {selectedFile.name}</p>
            <p>Size: {formatFileSize(selectedFile.size)}</p>
          </div>
        )}

        {errorMessage && (
          <div className="error-message">
            {errorMessage}
          </div>
        )}

        <button 
          onClick={handleUpload}
          disabled={!selectedFile || uploadStatus === 'uploading'}
          className="upload-button"
        >
          {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload File'}
        </button>

        {uploadStatus === 'uploading' && (
          <div className="progress-section">
            <div className="progress-bar-container">
              <div 
                className="progress-bar"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="progress-info">
              <span>{uploadProgress.toFixed(1)}%</span>
              {estimatedTime && (
                <span>Estimated time remaining: {formatEstimatedTime(estimatedTime)}</span>
              )}
            </div>
          </div>
        )}

        {uploadStatus === 'completed' && (
          <div className="success-message">
            Upload completed successfully!
          </div>
        )}

        {/* Stored Files Section */}
        <div className="stored-files-section">
          <h2>Stored Files</h2>
          {storedFiles.length === 0 ? (
            <p>No files stored yet</p>
          ) : (
            <ul className="stored-files-list">
              {storedFiles.map((file) => (
                <li key={file.name} className="stored-file-item">
                  <div className="file-details">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </div>
                  <button 
                    onClick={() => handleDelete(file.name)}
                    className="delete-button"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;