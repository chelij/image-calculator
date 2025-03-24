import React, { useState, useCallback } from 'react';
import { ipcRenderer } from 'electron';
import { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import '../styles/App.css';

interface CalculationHistory {
  expression: string;
  result: number;
  timestamp: number;
}

interface NumberItem {
  value: number;
  modifier: '+' | '-' | '×' | '÷';
}

const MODIFIERS = [
  { value: '+', label: '+' },
  { value: '-', label: '-' },
  { value: '×', label: '×' },
  { value: '÷', label: '÷' }
] as const;

const numberFormatter = new Intl.NumberFormat('en-US');

const App: React.FC = () => {
  const [numbers, setNumbers] = useState<NumberItem[]>([]);
  const [result, setResult] = useState<number | null>(null);
  const [history, setHistory] = useState<CalculationHistory[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const processImage = async (imageData: string) => {
    try {
      setIsProcessing(true);
      setError(null);
      setProgress(0);

      // Preprocess image
      const preprocessResult = await ipcRenderer.invoke('preprocess-image', imageData);
      if (!preprocessResult.success) {
        throw new Error(preprocessResult.error);
      }

      // Initialize Tesseract worker
      const worker = await createWorker({
        logger: m => {
          console.log('Tesseract progress:', m);
          if ('progress' in m && typeof m.progress === 'number') {
            setProgress(m.progress * 100);
          }
        }
      });

      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      // Perform OCR
      const { data: { text } } = await worker.recognize(preprocessResult.data);
      await worker.terminate();

      // Extract numbers from text and default modifier to '+'
      const extractedNumbers = text
        .split(/\s+/)
        .map(word => word.replace(/[^\d.-]/g, ''))
        .filter(num => num && !isNaN(Number(num)))
        .map(num => ({ value: Number(num), modifier: '+' as const }));

      if (extractedNumbers.length === 0) {
        throw new Error('No numbers found in the image');
      }

      setNumbers(prev => [...prev, ...extractedNumbers]);
    } catch (err) {
      console.error('OCR Error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = async (event) => {
          const imageData = event.target?.result as string;
          if (imageData) {
            await processImage(imageData);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const setModifier = (index: number, modifier: '+' | '-' | '×' | '÷') => {
    setNumbers(prev => {
      const newNumbers = [...prev];
      if (newNumbers[index]) {
        newNumbers[index] = { ...newNumbers[index], modifier };
      }
      return newNumbers;
    });
  };

  const calculateResult = useCallback(() => {
    if (numbers.length === 0) return;

    let result = numbers[0].value;
    let expression = numbers[0].value.toString();

    for (let i = 0; i < numbers.length - 1; i++) {
      const currentNumber = numbers[i];
      const nextNumber = numbers[i + 1];

      if (!currentNumber.modifier) continue;

      expression += ` ${currentNumber.modifier} ${nextNumber.value}`;

      switch (currentNumber.modifier) {
        case '+':
          result += nextNumber.value;
          break;
        case '-':
          result -= nextNumber.value;
          break;
        case '×':
          result *= nextNumber.value;
          break;
        case '÷':
          if (nextNumber.value === 0) {
            setError('Cannot divide by zero');
            return;
          }
          result /= nextNumber.value;
          break;
      }
    }

    setResult(result);
    setHistory(prev => [{
      expression,
      result,
      timestamp: Date.now()
    }, ...prev]);
  }, [numbers]);

  const clearNumbers = useCallback(() => {
    setNumbers([]);
    setResult(null);
    setError(null);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const deleteNumber = (index: number) => {
    setNumbers(prev => prev.filter((_, i) => i !== index));
    setResult(null); // Clear result when numbers change
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
  };

  const handleEdit = (index: number, newValue: string) => {
    const value = Number(newValue);
    if (!isNaN(value)) {
      setNumbers(prev => {
        const newNumbers = [...prev];
        newNumbers[index] = { ...newNumbers[index], value };
        return newNumbers;
      });
    }
  };

  const finishEditing = () => {
    setEditingIndex(null);
    setResult(null); // Clear result when numbers change
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Image Calculator</h1>
      </header>

      <main className="main">
        <div className="dropzone" onPaste={handlePaste}>
          <p>Paste an image here (Ctrl+V)</p>
          {isProcessing && (
            <div className="processing">
              <p>Processing...</p>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p>{Math.round(progress)}%</p>
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="calculator-section">
          <div className="calculator-header">
            <div className="actions">
              <button 
                onClick={calculateResult} 
                disabled={numbers.length === 0 || numbers.some((num, i) => i < numbers.length - 1 && !num.modifier)}
              >
                Calculate Result
              </button>
              <button onClick={clearNumbers}>
                Clear All
              </button>
            </div>
            {result !== null && (
              <div className="result">
                <span>Result: {numberFormatter.format(result)}</span>
                <button 
                  className="copy-button"
                  onClick={() => copyToClipboard(result.toString())}
                  title="Copy result"
                >
                  Copy
                </button>
              </div>
            )}
          </div>

          <div className="numbers">
            <div className="number-list">
              {numbers.map((num, index) => (
                <div key={index} className="number-group">
                  <div className="number-controls">
                    {editingIndex === index ? (
                      <input
                        type="text"
                        className="number-edit-input"
                        value={num.value}
                        onChange={(e) => handleEdit(index, e.target.value)}
                        onBlur={finishEditing}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') finishEditing();
                          if (e.key === 'Escape') {
                            setEditingIndex(null);
                            // Revert changes if needed
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <>
                        <button
                          className="number-action-button"
                          onClick={() => deleteNumber(index)}
                          title="Delete number"
                        >
                          🗑️
                        </button>
                        <div className="number-item" onClick={() => startEditing(index)}>
                          {numberFormatter.format(num.value)}
                        </div>
                      </>
                    )}
                  </div>
                  {index < numbers.length - 1 && (
                    <div className="modifier-selector">
                      <select
                        value={num.modifier}
                        onChange={(e) => setModifier(index, e.target.value as '+' | '-' | '×' | '÷')}
                        className="modifier-select"
                      >
                        {MODIFIERS.map(mod => (
                          <option key={mod.value} value={mod.value}>
                            {mod.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="history">
          <h2>History</h2>
          <div className="history-list">
            {history.map((item, index) => (
              <div key={index} className="history-item">
                <div className="history-numbers">
                  {item.expression.split(' ').map((part, i) => {
                    const num = Number(part);
                    return isNaN(num) ? part : numberFormatter.format(num);
                  }).join(' ')} = {numberFormatter.format(item.result)}
                </div>
                <button 
                  className="copy-button"
                  onClick={() => copyToClipboard(item.result.toString())}
                  title="Copy result"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App; 