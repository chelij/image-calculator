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
      `^-?\\d+(?:${thousandSeparator}\\d{3})*(?:${decimalPoint}\\d+)?$`
    );

    // If it matches current format, parse it normally
    if (currentFormatRegex.test(cleanText)) {
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
    // by checking if it has exactly 2 or 3 digits after it
    const digitsAfterComma = lastCommaIndex > -1 ? length - lastCommaIndex - 1 : 0;
    const digitsAfterPeriod = lastPeriodIndex > -1 ? length - lastPeriodIndex - 1 : 0;

    let detectedThousandSep = '';
    let detectedDecimalPoint = '';

    // If there's only one separator, determine its role based on position
    if (commaCount + periodCount === 1) {
      if (commaCount === 1) {
        detectedDecimalPoint = digitsAfterComma === 2 || digitsAfterComma === 3 ? ',' : '.';
        detectedThousandSep = detectedDecimalPoint === ',' ? '.' : ',';
      } else {
        detectedDecimalPoint = digitsAfterPeriod === 2 || digitsAfterPeriod === 3 ? '.' : ',';
        detectedThousandSep = detectedDecimalPoint === '.' ? ',' : '.';
      }
    } 
    // If there are multiple separators, analyze their pattern
    else if (commaCount + periodCount > 1) {
      if (commaCount > periodCount) {
        detectedThousandSep = ',';
        detectedDecimalPoint = '.';
      } else if (periodCount > commaCount) {
        detectedThousandSep = '.';
        detectedDecimalPoint = ',';
      } else {
        // If equal counts, use the last separator position to determine
        detectedDecimalPoint = lastCommaIndex > lastPeriodIndex ? ',' : '.';
        detectedThousandSep = detectedDecimalPoint === ',' ? '.' : ',';
      }
    }

    // Parse the number using detected format
    if (detectedThousandSep || detectedDecimalPoint) {
      cleanText = cleanText
        .replace(new RegExp(`\\${detectedThousandSep}`, 'g'), '')
        .replace(new RegExp(`\\${detectedDecimalPoint}`, 'g'), '.');
    }

    return parseFloat(cleanText);
  };

  const formatNumber = (number) => {
    const formatted = number.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 20,
      useGrouping: thousandSeparator !== '',
    });

    if (thousandSeparator !== '') {
      return formatted.replace(/,/g, thousandSeparator);
    }
    return formatted;
  };

  const copyNumber = (number) => {
    const rawNumber = number.toString();
    navigator.clipboard.writeText(rawNumber);
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
            load_freq_dawg: '0'
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
          
          let allNumbers = [];
          
          if (isRowBasedProcessing) {
            // Process each line as a single number
            for (const line of lines) {
              // Remove all spaces and non-numeric characters except . and ,
              const cleanLine = line.replace(/[^0-9,.-]/g, '');
              
              if (cleanLine) {
                let processedNumber = cleanLine;
                const lastCommaIndex = cleanLine.lastIndexOf(',');
                const lastPeriodIndex = cleanLine.lastIndexOf('.');

                // If no decimal point is selected, remove all separators
                if (decimalPoint === '') {
                  processedNumber = cleanLine.replace(/[.,]/g, '');
                }
                // If decimal point is selected and we have separators
                else if (lastCommaIndex > -1 || lastPeriodIndex > -1) {
                  const lastSeparatorIsComma = lastCommaIndex > lastPeriodIndex;
                  const lastSeparator = lastSeparatorIsComma ? ',' : '.';
                  const lastSeparatorIndex = lastSeparatorIsComma ? lastCommaIndex : lastPeriodIndex;
                  const digitsAfter = cleanLine.length - lastSeparatorIndex - 1;

                  // If the last separator matches user's decimal point preference
                  if (lastSeparator === decimalPoint) {
                    // Keep this separator if it's the preferred decimal point
                    processedNumber = cleanLine.replace(
                      new RegExp(`[${lastSeparator === '.' ? ',' : '.'}]`, 'g'),
                      ''
                    );
                  } 
                  // If it's not the preferred decimal point
                  else {
                    // If there are 3 or more digits after, treat as thousand separator
                    if (digitsAfter >= 3) {
                      processedNumber = cleanLine.replace(/[.,]/g, '');
                    }
                    // If there are 2 digits after, remove the separator
                    else if (digitsAfter === 2) {
                      processedNumber = cleanLine.replace(/[.,]/g, '');
                    }
                    // For any other case, remove all separators
                    else {
                      processedNumber = cleanLine.replace(/[.,]/g, '');
                    }
                  }
                }

                allNumbers.push(processedNumber);
              }
            }
          } else {
            // Existing number processing logic for non-row-based mode
            for (const line of lines) {
              const cleanLine = line.replace(/[A-Za-z$€£¥₹]+/g, '').trim();
              const numberRegex = /-?\d+(?:[.,]\d{3})*(?:[.,]\d+)?/g;
              const lineNumbers = cleanLine.match(numberRegex) || [];
              
              if (lineNumbers.length > 0) {
                lineNumbers.forEach(num => {
                  allNumbers.push(num);
                });
              }
            }
          }
          
          console.log('Extracted numbers:');
          console.table(allNumbers.map((num, index) => ({ 
            index: index + 1, 
            number: num,
            parsed: parseNumberWithFormat(num)
          })));
          
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

          const parsedNumbers = allNumbers.map(n => parseNumberWithFormat(n));
          console.log('Parsed numbers:');
          console.table(parsedNumbers.map((num, index) => ({ 
            index: index + 1, 
            number: num 
          })));
          
          setNumbers(parsedNumbers);
          setOperators(new Array(parsedNumbers.length - 1).fill('+'));
          
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
    let result = numbers[0];
    for (let i = 0; i < operators.length; i++) {
      switch (operators[i]) {
        case '+':
          result += numbers[i + 1];
          break;
        case '-':
          result -= numbers[i + 1];
          break;
        case '*':
          result *= numbers[i + 1];
          break;
        case '/':
          result /= numbers[i + 1];
          break;
      }
    }
    setResult(result);
    setHistory([...history, { numbers, operators, result }]);
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

      <div className="numbers-container">
        {numbers.map((num, index) => (
          <React.Fragment key={index}>
            <div className="number-group">
              <span className="number-item">{formatNumber(num)}</span>
              <button 
                className="delete-button" 
                onClick={() => deleteNumber(index)}
                title="Delete number"
              >
                ×
              </button>
            </div>
            {index < numbers.length - 1 && (
              <select
                className="operator-select"
                value={operators[index]}
                onChange={(e) => {
                  const newOperators = [...operators];
                  newOperators[index] = e.target.value;
                  setOperators(newOperators);
                }}
              >
                <option value="+">+</option>
                <option value="-">−</option>
                <option value="*">×</option>
                <option value="/">÷</option>
              </select>
            )}
          </React.Fragment>
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
    </div>
  );
}

export default App; 