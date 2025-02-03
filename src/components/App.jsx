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

  const parseNumberWithFormat = (text) => {
    const normalizedText = text
      .replace(new RegExp(`\\${thousandSeparator}`, 'g'), '')
      .replace(new RegExp(`\\${decimalPoint}`, 'g'), '.');
    return parseFloat(normalizedText);
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
            },
            workerPath: 'https://unpkg.com/tesseract.js@v4.1.1/dist/worker.min.js',
            corePath: 'https://unpkg.com/tesseract.js-core@v4.0.3/tesseract-core.wasm.js',
            langPath: 'https://raw.githubusercontent.com/naptha/tessdata/4.0.0_best/4.0.0_best'
          });

          console.log('Worker created');
          setProgressMessage('Loading language...');
          await worker.loadLanguage('eng');
          
          console.log('Language loaded');
          setProgressMessage('Initializing engine...');
          await worker.initialize('eng');
          
          console.log('Engine initialized');
          setProgressMessage('Processing image...');
          const { data: { text } } = await worker.recognize(blob);
          
          console.log('Recognized text:', text);
          
          // Split text by newlines and clean up each line
          const lines = text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line);
          console.log('Split lines:\n', lines.join('\n'));
          
          let allNumbers = [];
          
          // Process each line
          for (const line of lines) {
            // Remove currency symbols and extra spaces
            const cleanLine = line.replace(/[A-Za-z$€£¥₹]+/g, '').trim();
            
            // Extract numbers from each line, including those with missing thousand separators
            const numberRegex = new RegExp(
              `\\d+(?:${thousandSeparator}\\d{3})*(?:\\d{3})*(?:\\${decimalPoint}\\d+)?`,
              'g'
            );
            const lineNumbers = cleanLine.match(numberRegex) || [];
            
            if (lineNumbers.length > 0) {
              lineNumbers.forEach(num => {
                // Check if this might be a number with missing thousand separator
                if (num.length > 3 && !num.includes(thousandSeparator) && !num.includes(decimalPoint)) {
                  // Insert thousand separators
                  const reversedNum = num.split('').reverse();
                  let formattedNum = '';
                  for (let i = 0; i < reversedNum.length; i++) {
                    if (i > 0 && i % 3 === 0) {
                      formattedNum = thousandSeparator + formattedNum;
                    }
                    formattedNum = reversedNum[i] + formattedNum;
                  }
                  allNumbers.push(formattedNum);
                } else {
                  allNumbers.push(num);
                }
              });
            }
          }
          
          console.log('Extracted numbers:');
          console.table(allNumbers.map((num, index) => ({ 
            index: index + 1, 
            number: num 
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
            </select>
          </label>
        </div>
      </div>

      <div 
        className="paste-area" 
        onPaste={handlePaste}
        tabIndex="0" // Makes the div focusable
      >
        <div className="paste-instructions">
          {isProcessing ? (
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