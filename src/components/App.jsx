import React, { useState, useEffect } from 'react';
import { createWorker } from 'tesseract.js';

function App() {
  const [numbers, setNumbers] = useState([]);
  const [operators, setOperators] = useState([]);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [thousandSeparator, setThousandSeparator] = useState(',');
  const [decimalPoint, setDecimalPoint] = useState('.');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isTrainingDataReady, setIsTrainingDataReady] = useState(false);
  const [isRowBasedProcessing, setIsRowBasedProcessing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isAddToExisting, setIsAddToExisting] = useState(true);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pendingNumbers, setPendingNumbers] = useState(null);

  // Get the tessdata path from the renderer process arguments
  const getTessdataPath = () => {
    const args = window.process.argv;
    const tessdataArg = args.find(arg => arg.startsWith('--tessdata-path='));
    return tessdataArg ? tessdataArg.split('=')[1] : null;
  };

  // Check if training data exists
  useEffect(() => {
    const checkTrainingData = async () => {
      const tessdataPath = getTessdataPath();
      if (!tessdataPath) {
        console.error('Tessdata path not found in process arguments');
        setIsTrainingDataReady(false);
        return;
      }

      try {
        const fs = window.require('fs');
        const path = window.require('path');
        const trainingDataPath = path.join(tessdataPath, 'eng.traineddata');
        const exists = fs.existsSync(trainingDataPath);
        setIsTrainingDataReady(exists);
        if (!exists) {
          console.error('Training data file not found:', trainingDataPath);
        }
      } catch (error) {
        console.error('Error checking training data:', error);
        setIsTrainingDataReady(false);
      }
    };

    checkTrainingData();
  }, []);

  // Enhanced number parsing function
  const parseNumberWithFormat = (text) => {
    // First, clean up the text
    let cleanText = text.trim();
    
    // Check if the number uses the current format settings
    const currentFormatRegex = new RegExp(
      `^-?\\d+(?:${thousandSeparator === '.' ? '\\.' : thousandSeparator}\\d{3})*(?:${decimalPoint === '.' ? '\\.' : decimalPoint}\\d+)?$`
    );

    // If it matches current format, parse it normally
    if (currentFormatRegex.test(cleanText)) {
      // If decimal point is empty, remove all separators
      if (decimalPoint === '') {
        return parseFloat(cleanText.replace(/[.,]/g, ''));
      }
      return parseFloat(
        cleanText
          .replace(new RegExp(`\\${thousandSeparator}`, 'g'), '')
          .replace(new RegExp(`\\${decimalPoint}`, 'g'), '.')
      );
    }

    // If it doesn't match current format, try to intelligently determine the format
    const commaCount = (cleanText.match(/,/g) || []).length;
    const periodCount = (cleanText.match(/\./g) || []).length;
    
    // Analyze the positions of commas and periods
    const lastCommaIndex = cleanText.lastIndexOf(',');
    const lastPeriodIndex = cleanText.lastIndexOf('.');
    const length = cleanText.length;

    // Determine if the last separator is likely a decimal point
    const digitsAfterComma = lastCommaIndex > -1 ? length - lastCommaIndex - 1 : 0;
    const digitsAfterPeriod = lastPeriodIndex > -1 ? length - lastPeriodIndex - 1 : 0;

    // If no decimal point is selected, remove all separators
    if (decimalPoint === '') {
      return parseFloat(cleanText.replace(/[.,]/g, ''));
    }

    let detectedThousandSep = '';
    let detectedDecimalPoint = '';

    // If there's only one separator, determine its role based on position
    if (commaCount + periodCount === 1) {
      if (commaCount === 1) {
        // If it's the last position and followed by 1-3 digits, it's likely a decimal point
        detectedDecimalPoint = (digitsAfterComma > 0 && digitsAfterComma <= 3) ? ',' : '.';
        detectedThousandSep = detectedDecimalPoint === ',' ? '.' : ',';
      } else {
        // Same logic for period
        detectedDecimalPoint = (digitsAfterPeriod > 0 && digitsAfterPeriod <= 3) ? '.' : ',';
        detectedThousandSep = detectedDecimalPoint === '.' ? ',' : '.';
      }
    } 
    // If there are multiple separators, analyze their pattern
    else if (commaCount + periodCount > 1) {
      const lastSeparator = lastCommaIndex > lastPeriodIndex ? ',' : '.';
      const digitsAfterLast = lastSeparator === ',' ? digitsAfterComma : digitsAfterPeriod;

      // If the last separator has 1-3 digits after it, it's likely a decimal point
      if (digitsAfterLast > 0 && digitsAfterLast <= 3) {
        detectedDecimalPoint = lastSeparator;
        detectedThousandSep = lastSeparator === ',' ? '.' : ',';
      } else {
        // Otherwise, use the most frequent separator as thousand separator
        detectedThousandSep = commaCount > periodCount ? ',' : '.';
        detectedDecimalPoint = detectedThousandSep === ',' ? '.' : ',';
      }
    }

    // Parse the number using detected format
    if (detectedThousandSep || detectedDecimalPoint) {
      cleanText = cleanText
        .replace(new RegExp(`\\${detectedThousandSep}`, 'g'), '')
        .replace(new RegExp(`\\${detectedDecimalPoint}`, 'g'), '.');
    }

    const result = parseFloat(cleanText);
    return isNaN(result) ? 0 : result;
  };

  const formatNumber = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '0';

    const parts = number.toString().split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];

    // Format integer part with thousand separators if enabled
    let formattedInteger = thousandSeparator !== '' 
      ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator)
      : integerPart;

    // Add decimal part if it exists and decimal point is enabled
    if (decimalPart && decimalPoint !== '') {
      return `${formattedInteger}${decimalPoint}${decimalPart}`;
    }

    return formattedInteger;
  };

  const copyNumber = (number) => {
    const rawNumber = number.toString();
    navigator.clipboard.writeText(rawNumber);
  };

  const processOCRNumbers = (allNumbers) => {
    return allNumbers.map(num => {
      // Clean up the text
      let cleanText = num.trim();
      
      // If no decimal point is selected, remove all separators
      if (decimalPoint === '') {
        return parseFloat(cleanText.replace(/[.,]/g, ''));
      }

      // Count occurrences of commas and periods
      const commaCount = (cleanText.match(/,/g) || []).length;
      const periodCount = (cleanText.match(/\./g) || []).length;

      // If there's only one separator, use user's decimal point setting
      if (commaCount + periodCount === 1) {
        if (cleanText.includes(',')) {
          // If comma is used and matches user's decimal point, treat as decimal
          if (decimalPoint === ',') {
            return parseFloat(cleanText.replace(',', '.'));
          }
          // Otherwise treat as thousand separator
          return parseFloat(cleanText.replace(',', ''));
        } else {
          // If period is used and matches user's decimal point, treat as decimal
          if (decimalPoint === '.') {
            return parseFloat(cleanText);
          }
          // Otherwise treat as thousand separator
          return parseFloat(cleanText.replace('.', ''));
        }
      }

      // If there are multiple separators
      if (commaCount + periodCount > 1) {
        // Get the last separator
        const lastCommaIndex = cleanText.lastIndexOf(',');
        const lastPeriodIndex = cleanText.lastIndexOf('.');
        const lastSeparator = lastCommaIndex > lastPeriodIndex ? ',' : '.';
        
        // If last separator matches user's decimal point
        if (lastSeparator === decimalPoint) {
          // Replace all other separators and convert to standard format
          if (decimalPoint === ',') {
            return parseFloat(cleanText
              .replace(/\./g, '')  // Remove all periods
              .replace(',', '.')   // Convert comma to period for parseFloat
            );
          } else {
            return parseFloat(cleanText.replace(/,/g, '')); // Remove all commas
          }
        } else {
          // Last separator doesn't match decimal point, treat all as thousand seps
          return parseFloat(cleanText.replace(/[.,]/g, ''));
        }
      }

      // If no separators, just parse as is
      return parseFloat(cleanText);
    });
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData.items;
    console.log('Clipboard items:', items);
    
    for (let item of items) {
      console.log('Processing item type:', item.type);
      
      if (item.type.indexOf('image') !== -1) {
        setIsProcessing(true);
        setProgress(0);
        setProgressMessage('Initializing...');
        
        const blob = item.getAsFile();
        console.log('Image blob:', blob);

        let worker = null;
        try {
          const tessdataPath = getTessdataPath();
          console.log('Using tessdata path:', tessdataPath);

          worker = await createWorker({
            logger: m => {
              console.log('Tesseract status:', m);
              if (m.status === 'recognizing text') {
                setProgress(parseInt(m.progress * 100));
              }
              setProgressMessage(m.status);
            },
            errorHandler: err => {
              console.error('Tesseract error:', err);
              setProgressMessage(`OCR Error: ${err.message}`);
            },
            langPath: tessdataPath
          });

          if (!isTrainingDataReady) {
            setProgressMessage('Training data not ready. Please check installation.');
            return;
          }

          console.log('Worker created');
          setProgressMessage('Loading language...');
          await worker.loadLanguage('eng');
          
          console.log('Language loaded');
          setProgressMessage('Initializing engine...');
          await worker.initialize('eng', {
            tessedit_char_whitelist: '0123456789,.-',
            tessedit_pageseg_mode: '7',
            preserve_interword_spaces: '0',
            tessedit_ocr_engine_mode: '2',
            load_system_dawg: '0',
            load_freq_dawg: '0',
            tessedit_write_images: '1',  // Enable debug images
            tessedit_fix_superscripts: '0',  // Disable superscript detection
            tessedit_fix_subscripts: '0',    // Disable subscript detection
            tessedit_fix_hyphens: '0'        // Disable hyphen detection
          });
          
          console.log('Engine initialized');
          setProgressMessage('Processing image...');
          
          // Pre-process the image to improve OCR accuracy
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
          });
          
          // Set canvas size to match image
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw and process the image
          ctx.drawImage(img, 0, 0);

          // Enhance contrast for better OCR
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const threshold = 128;
            
            // Convert to black and white with increased contrast
            const newValue = avg > threshold ? 255 : 0;
            data[i] = data[i + 1] = data[i + 2] = newValue;
          }
          
          ctx.putImageData(imageData, 0, 0);
          
          // Convert back to blob
          const processedBlob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png');
          });
          
          const { data: { text } } = await worker.recognize(processedBlob);
          console.log('Recognized text:', text);
          
          // Split text by newlines and clean up each line
          const lines = text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line);
          console.log('Split lines:\n', lines.join('\n'));
          
          // Clean up OCR results
          const cleanupNumber = (text) => {
            // Remove any spaces
            let cleaned = text.trim().replace(/\s+/g, '');
            
            // Fix common OCR mistakes
            cleaned = cleaned
              // Remove trailing periods
              .replace(/\.+$/, '')
              // Fix cases where comma is read as period (common OCR mistake)
              .replace(/(\d)\.(\d{3}(?:[.,]\d+)?)/g, '$1,$2')
              // Remove any duplicate separators
              .replace(/[.,]{2,}/g, '.')
              // Clean up any remaining invalid patterns
              .replace(/[.,]+$/, '');

            return cleaned;
          };

          let allNumbers = [];
          
          if (isRowBasedProcessing) {
            // Process each line as a single number
            for (const line of lines) {
              // Remove all spaces and non-numeric characters except . and ,
              const cleanLine = cleanupNumber(line.replace(/[^0-9,.-]/g, ''));
              if (cleanLine) {
                allNumbers.push(cleanLine);
              }
            }
          } else {
            // Extract numbers from each line
            for (const line of lines) {
              const cleanLine = line.replace(/[A-Za-z$€£¥₹]+/g, '').trim();
              const numberRegex = /-?\d+(?:[.,]\d{3})*(?:[.,]\d+)?/g;
              const lineNumbers = cleanLine.match(numberRegex) || [];
              
              if (lineNumbers.length > 0) {
                allNumbers.push(...lineNumbers.map(cleanupNumber));
              }
            }
          }
          
          console.log('Extracted numbers:', allNumbers);
          
          if (allNumbers.length === 0) {
            console.log('No numbers found in text');
            setProgressMessage('No numbers found in image');
            setTimeout(() => {
              setIsProcessing(false);
              setProgress(0);
              setProgressMessage('');
            }, 2000);
            return;
          }

          // Process numbers according to user's format settings
          const parsedNumbers = processOCRNumbers(allNumbers);
          console.log('Parsed numbers:', parsedNumbers);
          
          // Use the toggle setting to determine how to handle new numbers
          if (numbers.length > 0) {
            if (isAddToExisting) {
              handleAddToExisting(parsedNumbers);
            } else {
              handleNewCalculation(parsedNumbers);
            }
          } else {
            // First paste always starts a new calculation
            setNumbers(parsedNumbers);
            setOperators(new Array(parsedNumbers.length - 1).fill('+'));
            // Auto calculate sum
            setTimeout(() => {
              let sum = parsedNumbers.reduce((a, b) => a + b, 0);
              setResult(sum);
              setHistory([{
                numbers: parsedNumbers,
                operators: new Array(parsedNumbers.length - 1).fill('+'),
                result: sum
              }]);
            }, 0);
          }
          
        } catch (error) {
          console.error('Detailed OCR Error:', error);
          console.error('Error stack:', error.stack);
          setProgressMessage(`Error: ${error.message}`);
          setTimeout(() => {
            setIsProcessing(false);
            setProgress(0);
            setProgressMessage('');
          }, 3000);
        } finally {
          if (worker) {
            await worker.terminate();
          }
          setIsProcessing(false);
        }
      } else {
        console.log('Non-image item found:', item.type);
        setProgressMessage('Please paste an image');
        setTimeout(() => {
          setProgressMessage('');
        }, 2000);
      }
    }
  };

  const calculate = () => {
    if (numbers.length === 0) return;

    let result = numbers[0];
    for (let i = 0; i < operators.length; i++) {
      switch (operators[i]) {
        case '+':
          result += numbers[i + 1];
          break;
        case '-':
          result -= numbers[i + 1];
          break;
        case '×':
          result *= numbers[i + 1];
          break;
        case '÷':
          result /= numbers[i + 1];
          break;
      }
    }
    setResult(result);
    // Add new entries at the beginning of the array
    setHistory([{ numbers, operators, result }, ...history]);
  };

  const handleNewCalculation = (newNumbers) => {
    setNumbers(newNumbers);
    setOperators(new Array(newNumbers.length - 1).fill('+'));
    // Auto calculate sum
    setTimeout(() => calculate(), 0);
  };

  const handleAddToExisting = (newNumbers) => {
    const combinedNumbers = [...numbers, ...newNumbers];
    const combinedOperators = [...operators, '+', ...new Array(newNumbers.length - 1).fill('+')];
    
    // Calculate new result immediately
    let newResult = combinedNumbers[0];
    for (let i = 0; i < combinedOperators.length; i++) {
      switch (combinedOperators[i]) {
        case '+':
          newResult += combinedNumbers[i + 1];
          break;
        case '-':
          newResult -= combinedNumbers[i + 1];
          break;
        case '×':
          newResult *= combinedNumbers[i + 1];
          break;
        case '÷':
          newResult /= combinedNumbers[i + 1];
          break;
      }
    }

    // Update all states at once
    setNumbers(combinedNumbers);
    setOperators(combinedOperators);
    setResult(newResult);
    setHistory([{ numbers: combinedNumbers, operators: combinedOperators, result: newResult }, ...history]);
  };

  const deleteNumber = (index) => {
    const newNumbers = [...numbers];
    const newOperators = [...operators];
    
    // Remove the number
    newNumbers.splice(index, 1);
    
    // Remove the operator before this number if it's not the first number
    // Otherwise remove the operator after it
    if (index > 0) {
      newOperators.splice(index - 1, 1);
    } else if (newOperators.length > 0) {
      newOperators.splice(0, 1);
    }
    
    setNumbers(newNumbers);
    setOperators(newOperators);
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditValue(numbers[index].toString());
  };

  const handleEditSave = (index) => {
    const newValue = parseNumberWithFormat(editValue);
    if (!isNaN(newValue)) {
      const newNumbers = [...numbers];
      newNumbers[index] = newValue;
      setNumbers(newNumbers);
    }
    setEditingIndex(null);
    setEditValue('');
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const handleCopyNumber = (number) => {
    navigator.clipboard.writeText(number.toString());
  };

  return (
    <div className="container">
      <h1>Image Calculator</h1>
      
      <div className="settings">
        <div className="setting-group">
          <label>
            Thousand Separator:
            <select 
              value={thousandSeparator} 
              onChange={(e) => setThousandSeparator(e.target.value)}
            >
              <option value=",">Comma (,)</option>
              <option value=".">Period (.)</option>
              <option value=" ">Space ( )</option>
              <option value="">None</option>
            </select>
          </label>
        </div>
        <div className="setting-group">
          <label>
            Decimal Point:
            <select 
              value={decimalPoint} 
              onChange={(e) => setDecimalPoint(e.target.value)}
            >
              <option value=".">Period (.)</option>
              <option value=",">Comma (,)</option>
              <option value="">No decimal point</option>
            </select>
          </label>
        </div>
        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isRowBasedProcessing}
              onChange={(e) => setIsRowBasedProcessing(e.target.checked)}
            />
            <span>Numbers in separate rows</span>
          </label>
        </div>
      </div>

      <div 
        className="paste-area" 
        onPaste={handlePaste}
        tabIndex="0"
      >
        <div className="paste-instructions">
          {!isTrainingDataReady ? (
            <div className="processing-status">
              <p>{progressMessage || 'Preparing OCR engine...'}</p>
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: '100%', animation: 'progress 2s infinite' }}></div>
              </div>
            </div>
          ) : isProcessing ? (
            <div className="processing-status">
              <p>{progressMessage}</p>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="progress-text">{progress}%</p>
            </div>
          ) : numbers.length > 0 ? (
            <p>✅ Image processed! Adjust operators below if needed.</p>
          ) : (
            <>
              <p>📋 Paste your image here (Ctrl+V)</p>
              <p className="paste-subtitle">Screenshot some numbers and paste them here</p>
            </>
          )}
        </div>
      </div>

      <div className="paste-settings">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isAddToExisting}
            onChange={(e) => setIsAddToExisting(e.target.checked)}
          />
          <span>Add new numbers to existing calculation</span>
        </label>
      </div>

      <div className="numbers-container">
        {numbers.map((number, index) => (
          <div key={index} className="number-group">
            {editingIndex === index ? (
              <>
                <input
                  type="text"
                  className="number-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditSave(index);
                    if (e.key === 'Escape') handleEditCancel();
                  }}
                  autoFocus
                />
                <button
                  className="edit-button"
                  onClick={() => handleEditSave(index)}
                  style={{ opacity: 1 }}
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <div className="number-item-container">
                  <button
                    className="edit-button"
                    onClick={() => handleEdit(index)}
                    title="Edit number"
                  >
                    <span className="icon icon-pencil"></span>
                  </button>
                  <div className="number-item">
                    {formatNumber(number)}
                  </div>
                  <button
                    className="copy-button"
                    onClick={() => handleCopyNumber(number)}
                    title="Copy number"
                  >
                    <span className="icon icon-clipboard"></span>
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => deleteNumber(index)}
                    title="Delete number"
                  >
                    <span className="icon icon-trash"></span>
                  </button>
                </div>
                {index < numbers.length - 1 && (
                  <select
                    className="operator-select"
                    value={operators[index] || '+'}
                    onChange={(e) => {
                      const newOperators = [...operators];
                      newOperators[index] = e.target.value;
                      setOperators(newOperators);
                    }}
                  >
                    <option value="+">+</option>
                    <option value="-">-</option>
                    <option value="×">×</option>
                    <option value="÷">÷</option>
                  </select>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      
      <div className="calculation-row">
        <button onClick={calculate} className="calculate-button">
          Calculate
        </button>
        <div className="result-container">
          {result !== null ? (
            <div className="result">
              <span className="result-value">Result: {formatNumber(result)}</span>
              <button onClick={() => copyNumber(result)}>
                Copy
              </button>
            </div>
          ) : (
            <div className="result placeholder">
              <span className="result-value">Result will appear here</span>
            </div>
          )}
        </div>
      </div>

      <div className="history">
        <div className="history-header">
          <h2>History</h2>
        </div>
        <div className="history-content">
          {history.map((entry, index) => (
            <div 
              key={index} 
              className="history-item"
              onClick={() => copyNumber(entry.result)}
            >
              <span className="history-result">{formatNumber(entry.result)}</span>
              <span className="copy-hint">Click to copy</span>
            </div>
          ))}
        </div>
      </div>

      {showPasteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>New Numbers Detected</h3>
            <p>How would you like to proceed?</p>
            <div className="modal-buttons">
              <button onClick={() => {
                setPendingNumbers(null);
                setShowPasteModal(false);
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 